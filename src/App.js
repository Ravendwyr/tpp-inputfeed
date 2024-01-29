import FontFaceObserver from 'fontfaceobserver';

import React, { Component } from 'react'

import rightArrow from './images/right90.png'
import leftArrow from './images/left90.png'
import upArrow from './images/up90.png'
import downArrow from './images/down90.png'
import './App.css'
import './RunBadge.css'

const CORE_ADDRESS = "192.168.1.6"; //"localhost";
const WS_PORT = 5001;
const API_PORT = 5010;

const FRAME_DURATION = 1000 / 60
const INPUT_HEIGHT = 50  // px
const SPACING = 12

function ButtonSet(props) {
    const buttons = props.buttons.map(function (button, index) {
        const wrap = inner => <span key={index}>{inner} </span>;
        if (props.theme !== "retro") {
            switch (button) {
                case "right":
                    return wrap(<img alt="e" className="arrow" src={rightArrow} />);
                case "left":
                    return wrap(<img alt="w" className="arrow" src={leftArrow} />);
                case "up":
                    return wrap(<img alt="n" className="arrow" src={upArrow} />);
                case "down":
                    return wrap(<img alt="s" className="arrow" src={downArrow} />);
                case "hold":
                    return wrap("-");
                default:
                    break;
            }
        }
        return wrap(button);
    });
    return <div className="ButtonSet">
        {buttons}
    </div>;
}

class Input extends Component {
    constructor(props) {
        super(props);
        this.state = {
            'nameScale': 1,
            'nameWidth': null,
            'actionScale': 1,
            'actionWidth': null,
        };
        this.userRef = React.createRef();
        this.userInnerRef = React.createRef();
        this.actionRef = React.createRef();
        this.actionInnerRef = React.createRef();
    }
    componentDidMount() {
        if (this.props.theme === "retro")
            return;
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
    jsFixWidth(scale, width) {
        if (this.props.theme === "retro")
            return {};
        return {
            'transform': 'scaleX(' + scale + ')',
            'transformOrigin': 'center left',
            'width': width
        };
    }
    renderName() {
        if (this.props.theme === "retro")
            return <div className="user">{this.props.user.name}</div>;

        return <div className="user" ref={this.userRef} style={this.jsFixWidth(this.state.nameScale, this.state.nameWidth)}>
            <div className="user-inner" ref={this.userInnerRef}>
                <User
                    user={this.props.user}
                    theme={this.props.theme}
                    runBadgeNumber={this.props.runBadgeNumber}
                    pkmnBadgeNumber={this.props.pkmnBadgeNumber}
                />
            </div>
        </div>;
    }
    renderUnderline(side) {
        return <div className="underline" data-side={side || "right"}>
            <div className="line"></div>
        </div>;
    }
    renderAction() {
        return <div className="action" ref={this.actionRef}>
            <div className="action-inner" ref={this.actionInnerRef} style={this.jsFixWidth(this.state.actionScale, this.state.actionWidth)}>
                <ButtonSet
                    theme={this.props.theme}
                    buttons={this.props.button_set}
                />
            </div>
        </div>;
    }
    render() {
        return <div
            className="Input"
            data-active={this.props.active}
            data-side={this.props.side}
            style={{ animationDuration: (this.props.frames * FRAME_DURATION) + 'ms' }}>
            {!!this.props.side && this.renderAction()}
            {!!this.props.side && this.renderUnderline("left")}
            {this.renderName()}
            {this.renderUnderline("right")}
            {this.renderAction()}
        </div>
    }
}

let badgesAndEmblemsAreAvailable = false;
function User(props) {
    if (!badgesAndEmblemsAreAvailable && (!!props.runBadgeNumber || !!props.pkmnBadgeNumber))
        badgesAndEmblemsAreAvailable = true;

    const runBadgeNumber = props.runBadgeNumber || 1;
    const pkmnBadgeNumber = props.pkmnBadgeNumber || 1
    const pkmnBadgeUrl = "/pkmn-badges/" + String(pkmnBadgeNumber).padStart(3, '0') + ".png"

    return <div className="User">
        {badgesAndEmblemsAreAvailable && <img
            alt=""
            className="pkmn-badge"
            src={pkmnBadgeUrl}
            data-hide={props.pkmnBadgeNumber === null}
        />}
        {badgesAndEmblemsAreAvailable && <span
            className="run-badge"
            data-number={runBadgeNumber}
            data-hide={props.runBadgeNumber === null}
        >
            {runBadgeNumber}
        </span>}
        <span className="name">{props.user.name}</span>
    </div>
}

function findInputById(inputs, inputId) {
    for (let i = 0; i < inputs.length; i++) {
        if (inputs[i].id === inputId) {
            return inputs[i]
        }
    }
}

function findInputRangeById(inputs, startInputId, endInputId) {
    const result = []
    for (let i = 0; i < inputs.length; i++) {
        if (inputs[i].id >= startInputId && inputs[i].id < endInputId) {
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
        const ws = new WebSocket(`ws://${CORE_ADDRESS}:${WS_PORT}/api`)
        ws.onopen = this.onOpen.bind(this)
        ws.onclose = this.onClose.bind(this)
        ws.onmessage = this.onMessage.bind(this)
    }
    onOpen() {
        const state = { ...INITIAL_INPUT_FEED_STATE }
        state.connected = true
        this.setState(state)
    }
    onClose() {
        this.setState({ 'connected': false }, this.connect)
    }
    onMessage(ev) {
        const msg = JSON.parse(ev.data)
        this.processMessage(msg.type, msg.extra_parameters)
    }
    processMessage(type, params) {
        if (type === 'new_anarchy_input') {
            // de-duplicate inputs (possible core bug)
            if (findInputById(this.state.inputs, params.id)) {
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
        } else if (type === 'anarchy_input_start') {
            //if(getRandomInt(0, 2) === 0) return  // test buggy core
            const newInputs = [...this.state.inputs]
            const input = findInputById(newInputs, params.id)
            // de-duplicate inputs (possible core bug)
            if (input && input.active) {
                return
            }
            const inputRange = findInputRangeById(newInputs, this.state.activeInputId, params.id)
            if (input) {
                input.active = true
                input.frames = params.frames
                input.sleep_frames = params.sleep_frames
                input.run_badge_number = params.run_badge_number
                input.pkmn_badge_number = params.pkmn_badge_number
                let completedInputCount = this.state.completedInputCount + inputRange.length
                let culledInputCount = this.state.culledInputCount
                let slidePositionOffset = this.state.slidePositionOffset
                while (completedInputCount > 30) {
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
        } else if (type === 'anarchy_input_stop') {
            const newInputs = [...this.state.inputs]
            const input = findInputById(newInputs, params.id)
            // de-duplicate inputs (possible core bug)
            if (input && input.complete) {
                return
            }
            if (input) {
                input.active = false
                input.complete = true
                this.setState({ 'inputs': newInputs })
            }
        }
    }
    render() {
        let self = this
        const inputComponents = this.state.inputs.map(function (input) {
            return <Input
                theme={self.props.theme}
                active={self.state.activeInputId === input.id}
                key={input.id}
                user={input.user}
                frames={input.frames}
                button_set={input.button_set}
                runBadgeNumber={input.run_badge_number}
                pkmnBadgeNumber={input.pkmn_badge_number}
            />
        })
        const style = {
            'transform': 'translateY(' + this.state.slidePosition * -1 + 'px)',
            'transition': 'transform ' + this.state.slideSpeed + 'ms linear'
        }
        if (!this.state.connected) {
            return <div className="InputFeed"></div>
        }
        return (
            <div className="InputFeed" data-theme={this.props.theme}>
                <div style={style} ref={this.middleRef}>
                    <div style={{ 'transform': 'translateY(' + this.state.slidePositionOffset + 'px)' }}>
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
    return n < 10 ? '0' + n : n
}

function ISODateString(d) {
    return d.getUTCFullYear() + '-'
        + pad(d.getUTCMonth() + 1) + '-'
        + pad(d.getUTCDate()) + 'T'
        + pad(d.getUTCHours()) + ':'
        + pad(d.getUTCMinutes()) + ':'
        + pad(d.getUTCSeconds()) + 'Z'
}


function secondsToDurationStr(seconds, spacing) {
    let prefix = "";
    if (seconds < 0) {
        prefix = "-";
        seconds = Math.abs(seconds);
    }
    const s = seconds % 60;
    const m = Math.floor(seconds / 60) % 60;
    const h = Math.floor(seconds / 60 / 60) % 24;
    const d = Math.floor(seconds / 60 / 60 / 24);

    let p = "";
    if (spacing) {
        p = " ";
    }

    return prefix + pad(d) + "d" + p + pad(h) + "h" + p + pad(m) + "m" + p
        + pad(s) + "s";
}


class OverlayComponent extends Component {
    constructor(props) {
        super(props);
        this.state = {
            "scaleX": 1.0,
            "scaleY": 1.0,
        };
        this.innerRef = React.createRef();
        this.updateScale = this.updateScale.bind(this);
    }
    updateScale() {
        if (!this.props.autoscale) {
            return;
        }
        const width = this.innerRef.current.offsetWidth;
        const height = this.innerRef.current.offsetHeight;
        const availableWidth = this.props.width || window.innerWidth;
        const availableHeight = this.props.height || window.innerHeight;
        const scaleX = availableWidth / width;
        const scaleY = availableHeight / height;
        if (scaleX !== this.state.scaleX || scaleY !== this.state.scaleY) {
            this.setState({ "scaleX": scaleX, "scaleY": scaleY });
        }
    }
    componentDidMount() {
        this.updateScale();
        window.addEventListener("resize", this.updateScale);
    }
    componentWillUnmount() {
        window.removeEventListener("resize", this.updateScale);
    }
    getStyle() {
        return {
            "transform": "scale(" + this.state.scaleX + ", " + this.state.scaleY + ")",
            "transformOrigin": "top left",
        };
    }
}



class Clock extends OverlayComponent {
    constructor(props) {
        super(props);
        this.state.now = new Date();
        this.updateTime = this.updateTime.bind(this);
        this.updateTimeInterval = null;
    }
    updateTime() {
        const now = new Date();
        this.setState({ "now": now }, this.updateScale);
    }
    componentDidMount() {
        super.componentDidMount();
        this.updateTimeInterval = setInterval(this.updateTime, 1000);
    }
    componentWillUnmount() {
        super.componentWillUnmount();
        clearInterval(this.updateTimeInterval);
    }
    getStr() {
        let s = ISODateString(this.state.now);
        if (this.props.theme === "retro") {
            s = s.replace("Z", "").replace("T", " ");
        }
        return s;
    }
    render() {
        const s = this.getStr()
        const style = super.getStyle();
        return <div
            className="Clock"
            style={style}
            data-theme={this.props.theme}
        >
            <span className="inner" ref={this.innerRef}>{s}</span>
        </div>
    }
}


class RetroTitle extends OverlayComponent {
    render() {
        const style = super.getStyle();
        return <article
            className="RetroTitle"
            style={style}
            data-theme={this.props.theme}
        >
            <span className="inner" ref={this.innerRef}>
                <div className="title-line-1">
                    <span className="word-1">Twitch</span>
                    &nbsp;
                    <span className="word-2">Plays</span>
                </div>
                <div className="title-line-2">Pokemon</div>
            </span>
        </article>
    }
}

class Timer extends OverlayComponent {
    constructor(props) {
        super(props);
        this.state.now = new Date();
        this.updateTime = this.updateTime.bind(this);
        this.updateTimeInterval = null;
        this.startRunEventFired = false;
    }
    updateTime() {
        const now = new Date();
        this.setState({ "now": now }, this.updateScale);
        if (!this.startRunEventFired && now > this.props.startDate) {
            this.startRunEventFired = true;
            console.log("start run event fired");
            fetch(`http://${CORE_ADDRESS}:${API_PORT}/start_run`, { mode: "no-cors" });
        }
    }
    componentDidMount() {
        super.componentDidMount();
        this.updateTimeInterval = setInterval(this.updateTime, 1000);
    }
    componentWillUnmount() {
        clearInterval(this.updateTimeInterval);
        super.componentWillUnmount();
    }
    getStr() {
        const secondsFromStart = Math.floor(
            (this.state.now - this.props.runStartDate) / 1000
        );
        return secondsToDurationStr(
            secondsFromStart,
            this.props.timerSpacing,
        );
    }
    render() {
        const s = this.getStr()
        const style = super.getStyle();
        return <div
            className="Timer"
            style={style}
            data-theme={this.props.theme}
        >
            <span className="inner" ref={this.innerRef}>{s}</span>
        </div>
    }
}


class BigCountdown extends OverlayComponent {
    constructor(props) {
        super(props);
        this.state.now = new Date();
        this.updateNow = this.updateNow.bind(this);
        this.updateInterval = null;
    }
    componentDidMount() {
        super.componentDidMount();
        this.updateInterval = setInterval(this.updateNow, 100);
    }
    componentWillUnmount() {
        clearInterval(this.updateInterval);
    }
    updateNow() {
        this.setState({ "now": new Date() })
    }
    render() {
        const secondsFromStart = Math.floor(
            (this.state.now - this.props.date) / 1000
        );
        if (secondsFromStart >= 0) {
            return "";
        }
        let s = secondsToDurationStr(secondsFromStart).replace("-", "");
        const style = super.getStyle();

        return <div
            className="BigCountdown"
            style={style}
            data-theme={this.props.theme}
        >
            <span className="inner" ref={this.innerRef}>
                {this.props.label}{s}
            </span>
        </div>
    }
}

class App extends Component {
    state = { fontLoaded: false };
    _isMounted = false;
    params = new URLSearchParams(window.location.search);

    componentDidMount() {
        const theme = this.params.get("theme");
        if (theme)
            document.querySelector(':root').setAttribute("data-theme", theme);
        const fontName = "gen1";
        this._isMounted = true;
        const font = new FontFaceObserver(fontName);

        font.load().then(() => {
            if (this._isMounted) {
                this.setState({ fontLoaded: true });
            }
        }).catch(error => {
            if (this._isMounted) {
                console.error('Font loading failed:', error);
            }
        });
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    render() {
        if (!this.state.fontLoaded) {
            return null;
        }
        const params = this.params;

        const autoscale = params.get("autoscale") === "true";
        const theme = params.get("theme") || null;

        //const timerSpacing = params.get("timer_spacing") === "true";
        const countdownLabel = params.get("countdown_label") || null;
        let countdownDate = params.get("countdown_date") || null;
        if (countdownDate) {
            countdownDate = Date.parse(countdownDate);
        }

        let runStartDate = params.get("run_start_date") || null;
        if (runStartDate) {
            runStartDate = Date.parse(runStartDate);
        }

        if (window.location.pathname === '/clock') {
            return <Clock
                theme={theme}
                autoscale={autoscale}
            />
        } else if (window.location.pathname === '/timer') {
            return <Timer
                theme={theme}
                autoscale={autoscale}
                startDate={runStartDate}
            />
        } else if (window.location.pathname === '/countdown') {
            return <BigCountdown
                theme={theme}
                autoscale={autoscale}
                label={countdownLabel}
                date={countdownDate}
            />
        } else if (window.location.pathname === '/input_feed') {
            return <InputFeed
                theme={theme}
            />
        } else if (window.location.pathname !== "/") {
            return <div>Unexpected URL path. Valid paths are /clock /timer /countdown and /input_feed.</div>
        }


        return <div className="OverlayTest">
            <InputFeed theme={"retro"} />
            <Clock
                width="540"
                height="80"
                autoscale={false}
                theme={"retro"}
            />
            <Timer
                width="540"
                height="80"
                autoscale={false}
                theme={"retro"}
                timerSpacing={true}
                runStartDate={Date.parse("2024-02-12T05:57:22.000Z")}
            />
            <RetroTitle
                width="540"
                height="100"
                autoscale={true}
                theme={"retro"}
            />
            <BigCountdown
                label={"Pokemon Red in "}
                date={Date.parse("2024-02-12T05:57:22.000Z")}
                width="540"
                height="80"
                autoscale={false}
                theme={"retro"}
            />
        </div>
    }
}

export default App
