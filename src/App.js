import React, { Component } from 'react'

import rightArrow from './right90.png'
import leftArrow from './left90.png'
import upArrow from './up90.png'
import downArrow from './down90.png'
import './App.css'

const FRAME_DURATION = 1000 / 60
const INPUT_HEIGHT = 50  // px
const SPACING = 12

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

function ButtonSet(props) {
    const buttons = props.buttons.map(function(button, index) {
        if(button === 'right') {
            return <span key={index}><img className="arrow" src={rightArrow} /> </span>
        } else if(button === 'left') {
            return <span key={index}><img className="arrow" src={leftArrow} /> </span>
        } else if(button === 'up') {
            return <span key={index}><img className="arrow" src={upArrow} /> </span>
        } else if(button === 'down') {
            return <span key={index}><img className="arrow" src={downArrow} /> </span>
        } else if(button === 'hold') {
            return <span key={index}>- </span>
        }
        return <span key={index}>{button} </span>
    })
    return <div className="ButtonSet">
        {buttons}
    </div>
}

class Input extends Component {
    constructor(props) {
        super(props)
        this.state = {
            'nameScale': 1,
            'nameWidth': null,
            'actionScale': 1,
            'actionWidth': null,
        }
        this.userRef = React.createRef()
        this.userInnerRef = React.createRef()
        this.actionRef = React.createRef()
        this.actionInnerRef = React.createRef()
    }
    componentDidMount() {
        const fullNameWidth = this.userInnerRef.current.offsetWidth
        const fullActionWidth = this.actionInnerRef.current.offsetWidth
        const availableWidth = window.innerWidth
        const newActionWidth = Math.min(availableWidth * 0.25, fullActionWidth)
        const remainingWidth = availableWidth - (SPACING * 6) - (newActionWidth * 2) - (SPACING * 2)
        const newNameWidth = Math.min(remainingWidth, fullNameWidth)
        const nameScale = newNameWidth / fullNameWidth
        const actionScale = newActionWidth / fullActionWidth
        this.setState({
            'nameWidth': newNameWidth,
            'nameScale': nameScale,
            'actionScale': actionScale,
            'actionWidth': newActionWidth
        })
    }
    render() {
        const nameStyle = {
            'transform': 'scaleX(' + this.state.nameScale + ')',
            'transformOrigin': 'center left',
            'width': this.state.nameWidth
        }
        const actionStyle = {
            'transform': 'scaleX(' + this.state.actionScale + ')',
            'transformOrigin': 'center left',
            'width': this.state.actionWidth
        }
        return <div
                className="Input"
                data-active={this.props.active}
                data-side={this.props.side}
                style={{animationDuration: (this.props.frames * FRAME_DURATION) + 'ms'}}>
            <div className="action" ref={this.actionRef}>
                <div className="action-inner" ref={this.actionInnerRef} style={actionStyle}>
                    <ButtonSet buttons={this.props.button_set} />
                </div>
            </div>
            <div className="underline" data-side="left">
                <div className="line"></div>
            </div>
            <div className="user" ref={this.userRef} style={nameStyle}>
                <div className="user-inner" ref={this.userInnerRef}>
                    {this.props.user.twitch_display_name}
                </div>
            </div>
            <div className="underline" data-side="right">
                <div className="line"></div>
            </div>
            <div className="action">
                <div className="action-inner" ref={this.actionInnerRef} style={actionStyle}>
                    <ButtonSet buttons={this.props.button_set} />
                </div>
            </div>
        </div>
    }
}

function findInputById(inputs, inputId) {
    for (let i = 0; i < inputs.length; i++) {
        if(inputs[i].id === inputId) {
            return inputs[i]
        }
    }
}

function findInputRangeById(inputs, startInputId, endInputId) {
    const result = []
    for (let i = 0; i < inputs.length; i++) {
        if(inputs[i].id >= startInputId && inputs[i].id < endInputId) {
            result.push(inputs[i])
        }
    }
    return result
}

const INITIAL_INPUT_FEED_STATE = {
    'connected': false,
    'inputs': [],
    'activeInputId': null,
    'pendingInputCount': 0,
    'completedInputCount': 0,
    'slidePosition': 0,
    'slidePositionOffset': window.innerHeight * (2 / 3),
    'culledInputCount': 0,
    'slideSpeed': 8000,
}

class InputFeed extends Component {
    constructor(props) {
        super(props)
        this.state = INITIAL_INPUT_FEED_STATE
        this.middleRef = React.createRef()
    }
    componentDidMount() {
        this.connect()
    }
    connect() {
        const ws = new WebSocket("ws://localhost:5001/api")
        ws.onopen = this.onOpen.bind(this)
        ws.onclose = this.onClose.bind(this)
        ws.onmessage = this.onMessage.bind(this)
    }
    onOpen() {
        const state = {...INITIAL_INPUT_FEED_STATE}
        state.connected = true
        this.setState(state)
    }
    onClose() {
        this.setState({'connected': false}, this.connect)
    }
    onMessage(ev) {
        const msg = JSON.parse(ev.data)
        this.processMessage(msg.type, msg.extra_parameters)
    }
    processMessage(type, params) {
        if(type === 'new_anarchy_input') {
            // de-duplicate inputs (possible core bug)
            if(findInputById(this.state.inputs, params.id)) {
                return
            }
            const newInputs = [...this.state.inputs]
            params.active = false
            params.complete = false
            params.frames = null
            params.sleep_frames = null
            newInputs.push(params)
            this.setState({
                'inputs': newInputs,
                'pendingInputCount': this.state.pendingInputCount + 1
            })
        } else if(type === 'anarchy_input_start') {
            //if(getRandomInt(0, 2) === 0) return  // test buggy core
            const newInputs = [...this.state.inputs]
            const input = findInputById(newInputs, params.id)
            // de-duplicate inputs (possible core bug)
            if(input && input.active) {
                return
            }
            const inputRange = findInputRangeById(newInputs, this.state.activeInputId, params.id)
            if(input) {
                input.active = true
                input.frames = params.frames
                input.sleep_frames = params.sleep_frames
                let completedInputCount = this.state.completedInputCount + inputRange.length
                let culledInputCount = this.state.culledInputCount
                let slidePositionOffset = this.state.slidePositionOffset
                while(completedInputCount > 30) {
                    newInputs.shift()
                    completedInputCount -= 1
                    culledInputCount += 1
                    slidePositionOffset += INPUT_HEIGHT
                }
                const targetSlideSpeed = ((params.frames + params.sleep_frames) * FRAME_DURATION) + 200
                //const slideSpeed = ((this.state.slideSpeed * 9) + targetSlideSpeed) / 10
                const slideSpeed = targetSlideSpeed
                this.setState({
                    'inputs': newInputs,
                    'activeInputId': input.id,
                    'pendingInputCount': this.state.pendingInputCount - inputRange.length,
                    'completedInputCount': completedInputCount,
                    'slidePosition': this.state.slidePosition + (INPUT_HEIGHT * inputRange.length),
                    'slidePositionOffset': slidePositionOffset,
                    'slideSpeed': slideSpeed,
                    'culledInputCount': culledInputCount,
                })
            }
        } else if(type === 'anarchy_input_stop') {
            const newInputs = [...this.state.inputs]
            const input = findInputById(newInputs, params.id)
            // de-duplicate inputs (possible core bug)
            if(input && input.complete) {
                return
            }
            if(input) {
                input.active = false
                input.complete = true
                this.setState({'inputs': newInputs})
            }
        }
    }
    render() {
        let self = this
        const inputComponents = this.state.inputs.map(function(input) {
            return <Input
                active={self.state.activeInputId === input.id}
                key={input.id}
                side={input.side}
                user={input.user}
                button_set={input.button_set}
            />
        })
        const style = {
            'transform': 'translateY(' + this.state.slidePosition * -1 + 'px)',
            'transition': 'transform ' + this.state.slideSpeed + 'ms linear'
        }
        if(!this.state.connected) {
            return <div className="App"></div>
        }
        return (
            <div className="App">
                <div style={style} ref={this.middleRef}>
                    <div style={{'transform': 'translateY(' + this.state.slidePositionOffset + 'px)'}}>
                        {inputComponents}
                    </div>
                </div>
                <div className="preload-imgs">
                    <img alt="" src={upArrow} />
                    <img alt="" src={downArrow} />
                    <img alt="" src={leftArrow} />
                    <img alt="" src={rightArrow} />
                </div>
            </div>
        )
    }
}


function pad(n) {
    return n<10 ? '0'+n : n
}

function ISODateString(d) {
     return d.getUTCFullYear()+'-'
          + pad(d.getUTCMonth()+1)+'-'
          + pad(d.getUTCDate())+'T'
          + pad(d.getUTCHours())+':'
          + pad(d.getUTCMinutes())+':'
          + pad(d.getUTCSeconds())+'Z'
}


function secondsToDurationStr(seconds) {
    let prefix = ''
    if(seconds < 0) {
        prefix = '-'
        seconds = Math.abs(seconds)
    }
    const s = seconds % 60
    const m = Math.floor(seconds / 60) % 60
    const h = Math.floor(seconds / 60 / 60) % 24
    const d = Math.floor(seconds / 60 / 60 / 24)
    return prefix + d + 'd' + pad(h) + 'h' + pad(m) + 'm' + pad(s) + 's'
}


class ClockAndTimer extends Component {
    constructor(props) {
        super(props)
        this.state = {
            'now': new Date(),
            'scaleX': 1.0,
            'scaleY': 1.0,
        }
        this.innerRef = React.createRef()
        this.updateScale = this.updateScale.bind(this)
        this.updateTime = this.updateTime.bind(this)
        this.startRunEventFired = false
    }
    updateScale() {
        const width = this.innerRef.current.offsetWidth
        const height = this.innerRef.current.offsetHeight
        const availableWidth = window.innerWidth
        const availableHeight = window.innerHeight
        const scaleX = availableWidth / width
        const scaleY = availableHeight / height
        if(scaleX !== this.state.scaleX || scaleY !== this.state.scaleY) {
            this.setState({'scaleX': scaleX, 'scaleY': scaleY})
        }
    }
    updateTime() {
        const now = new Date()
        this.setState({'now': now}, this.updateScale)
        if(!this.startRunEventFired && now > this.props.startDate) {
            this.startRunEventFired = true
            console.log('start run event fired')
            fetch('http://localhost:5010/start_run', {mode: 'no-cors'})
        }
    }
    componentDidMount() {
        this.updateScale()
        window.addEventListener('resize', this.updateScale)
        setInterval(this.updateTime, 1000)
    }
    getStr() {
        const secondsFromStart = Math.floor((this.state.now - this.props.startDate) / 1000)
        return ISODateString(this.state.now) + ' ' + secondsToDurationStr(secondsFromStart)
    }
    render() {
        const s = this.getStr()
        const style = {
            'transform': 'scale(' + this.state.scaleX + ', ' + this.state.scaleY + ')',
            'transformOrigin': 'top left'
        }
        return <div className="ClockAndTimer" style={style}>
            <span className="inner" ref={this.innerRef}>{s}</span>
        </div>
    }
}


class App extends Component {
    render() {
        if(window.location.pathname === '/clockandtimer') {
            let startDateStr = window.location.hash.substr(1)
            let startDate
            if(startDateStr) {
                startDate = Date.parse(startDateStr)
            } else {
                startDate = new Date()
            }
            return <ClockAndTimer startDate={startDate} />
        }
        return <InputFeed />
    }
}

export default App
