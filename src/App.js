import React, { Component } from 'react'

import rightArrow from './right90.png'
import leftArrow from './left90.png'
import upArrow from './up90.png'
import downArrow from './down90.png'
import './App.css'

const FRAME_DURATION = 1000 / 60
const INPUT_HEIGHT = 30  // px
const SPACING = 8

function ButtonSet(props) {
    const buttons = props.buttons.map(function(button) {
        if(button === 'right') {
            return <span><img className="arrow" src={rightArrow} /> </span>
        } else if(button === 'left') {
            return <span><img className="arrow" src={leftArrow} /> </span>
        } else if(button === 'up') {
            return <span><img className="arrow" src={upArrow} /> </span>
        } else if(button === 'down') {
            return <span><img className="arrow" src={downArrow} /> </span>
        } else if(button === 'hold') {
            return '-'
        }
        return button
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

class App extends Component {
    constructor(props) {
        super(props)
        this.state = {
            'inputs': [],
            'activeInputId': null,
            'pendingInputCount': 0,
            'completedInputCount': 0,
            'slidePosition': 0,
            'slidePositionOffset': window.innerHeight * (2 / 3),
            'culledInputCount': 0,
            'slideSpeed': 8000,
        }
        this.middleRef = React.createRef()
    }
    componentDidMount() {
        const ws = new WebSocket("ws://localhost:5001/api")
        ws.onmessage = this.onMessage.bind(this)
    }
    onMessage(ev) {
        const msg = JSON.parse(ev.data)
        this.processMessage(msg.type, msg.extra_parameters)
    }
    processMessage(type, params) {
        if(type === 'new_anarchy_input') {
            const newInputs = [...this.state.inputs]
            params.active = false
            params.frames = null
            params.sleep_frames = null
            newInputs.push(params)
            this.setState({
                'inputs': newInputs,
                'pendingInputCount': this.state.pendingInputCount + 1
            })
        } else if(type === 'anarchy_input_start') {
            const newInputs = [...this.state.inputs]
            const input = findInputById(newInputs, params.id)
            if(input) {
                input.active = true
                input.frames = params.frames
                input.sleep_frames = params.sleep_frames
                let completedInputCount = this.state.completedInputCount + 1
                let culledInputCount = this.state.culledInputCount
                let slidePositionOffset = this.state.slidePositionOffset
                if(completedInputCount > 30) {
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
                    'pendingInputCount': this.state.pendingInputCount - 1,
                    'completedInputCount': completedInputCount,
                    'slidePosition': this.state.slidePosition + INPUT_HEIGHT,
                    'slidePositionOffset': slidePositionOffset,
                    'slideSpeed': slideSpeed,
                    'culledInputCount': culledInputCount,
                })
            }
        } else if(type === 'anarchy_input_stop') {
            const newInputs = [...this.state.inputs]
            const input = findInputById(newInputs, params.id)
            if(input) {
                input.active = false
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
        return (
            <div className="App">
                <div style={style} ref={this.middleRef}>
                    <div style={{'transform': 'translateY(' + this.state.slidePositionOffset + 'px)'}}>
                        {inputComponents}
                    </div>
                </div>
                <div className="preload-imgs">
                    <img src={upArrow} />
                    <img src={downArrow} />
                    <img src={leftArrow} />
                    <img src={rightArrow} />
                </div>
            </div>
        )
    }
}

export default App
