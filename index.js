import React, { Component } from 'react'
import { View, TextInput, TouchableWithoutFeedback, Clipboard, Keyboard, Platform, AppState } from 'react-native'
import PropTypes from 'prop-types'
import styles from './styles'
import { isAutoFillSupported } from './helpers/device'

export default class OTPInputView extends Component {
    static propTypes = {
        pinCount: PropTypes.number,
        codeInputFieldStyle: PropTypes.object,
        codeInputHighlightStyle: PropTypes.object,
        onCodeFilled: PropTypes.func,
        onCodeChanged: PropTypes.func,
        autoFocusOnLoad: PropTypes.bool,
        code: PropTypes.string,
        secureTextEntry: PropTypes.bool,
        isFocused: PropTypes.bool
    }

    static defaultProps = {
        pinCount: 6,
        codeInputFieldStyle: null,
        codeInputHighlightStyle: null,
        onCodeFilled: null,
        autoFocusOnLoad: true,
        secureTextEntry: false,
        isFocused: true
    }

    fields = []

    constructor(props) {
        super(props)
        const { code } = props
        this.state = {
            digits: (code === undefined ? [] : code.split("")),
            selectedIndex: 0,
        }
    }

    componentWillReceiveProps(nextProps) {
        const { code, isFocused } = this.props
        if (nextProps.isFocused !== isFocused && nextProps.isFocused === false) {
            if (this._timer) {
                clearInterval(this._timer)
            }
        }
        
        if (nextProps.code !== code) {
            this.setState({ digits: (nextProps.code === undefined ? [] : nextProps.code.split("")) })
        }
    }

    componentDidMount() {
        this.copyCodeFromClipBoardOnAndroid()
        this.bringUpKeyBoardIfNeeded()
        this.keyboardDidHideListener = Platform.OS == 'android' ? Keyboard.addListener('keyboardDidHide', this.handleKeyboardDidHide) : () => {}
        AppState.addEventListener('change', this._handleAppStateChange);
    }

    _handleAppStateChange = (nextAppState) => {
        if (nextAppState === 'background') {
            this.blurAllFields()
        }
      };

    componentWillUnmount() {
        Platform.OS == 'android' && this.keyboardDidHideListener.remove()
        AppState.removeEventListener('change', this._handleAppStateChange);
        if (this._timer) {
            clearInterval(this._timer)
        }
    }

    copyCodeFromClipBoardOnAndroid = () => {
        if (Platform.OS === "android") {
            this.checkPinCodeFromClipBoard()
            this._timer = setInterval(() => {
                this.checkPinCodeFromClipBoard()
            }, 400)
        }
    }

    bringUpKeyBoardIfNeeded = () => {
        const { autoFocusOnLoad, pinCount } = this.props
        const digits = this.getDigits()
        const focusIndex = digits.length ? digits.length - 1 : 0
        if (focusIndex < pinCount && autoFocusOnLoad) {
            setTimeout(() => this.focusField(focusIndex), 150);
        }
    }

    getDigits = () => {
        const { digits: innerDigits } = this.state
        const { code } = this.props
        return code === undefined ? innerDigits : code.split("")
    }

    handleKeyboardDidHide = () => {
        this.blurAllFields() 
    }

    notifyCodeChanged = () => {
        const { digits } = this.state
        const code = digits.join("")
        const { onCodeChanged } = this.props
        if (onCodeChanged) {
            onCodeChanged(code)
        }
    }

    checkPinCodeFromClipBoard = () => {
        const { pinCount } = this.props
        Clipboard.getString().then(code => {
            if (this.hasCheckedClipBoard && code.length === pinCount && (this.clipBoardCode !== code)) {
                this.setState({
                    digits: code.split(""),
                }, () => {
                    this.blurAllFields()
                    this.notifyCodeChanged()
                })
            }
            this.clipBoardCode = code
            this.hasCheckedClipBoard = true
        }).catch(e => {
        })
    }

    handleChangeText = (index, text) => {
        if (text.length > 6) text = text.replace(/\s/g, '').match(/\d+/g)[0]
        const { onCodeFilled, pinCount } = this.props
        const digits = this.getDigits()
        let newdigits = digits.slice()
        const oldTextLength = newdigits[index] ? newdigits[index].length : 0
        const newTextLength = text.length
        if (newTextLength - oldTextLength === pinCount) { // user pasted text in.
            newdigits = text.split("").slice(oldTextLength, newTextLength)
            this.setState( {digits: newdigits }, this.notifyCodeChanged)
        } else {
            if (text.length === 0) {
                if (newdigits.length > 0) {
                    newdigits = newdigits.slice(0, newdigits.length-1)
                }
            } else {
                text.split("").forEach((value) => {
                    newdigits[index] = value
                    index += 1
                })
                index -= 1
            }
            this.setState({ digits: newdigits }, this.notifyCodeChanged)
        }

        let result = newdigits.join("")
        if (result.length >= pinCount) {
            onCodeFilled && onCodeFilled(result)
            this.focusField(pinCount - 1)
            this.blurAllFields()
        } else {
            if (text.length > 0 && index < pinCount - 1) {
                this.focusField(index + 1)
            }
        }
    }

    handleKeyPressTextInput = (index, key) => {
        const digits = this.getDigits()
        if(key === 'Backspace') {
            if (!digits[index] && index > 0) {
                this.handleChangeText(index - 1, '')
                this.focusField(index - 1)
            }
        }
    }

    focusField = (index) => {
        if (index < this.fields.length) {
            this.fields[index].focus()
            this.setState({
                selectedIndex: index
            })
        }
    }

    blurAllFields = () => {
        this.fields.forEach(field => field.blur())
        this.setState({
            selectedIndex: -1,
        })
    }

    renderOneInputField = ( _ , index ) => {
        const { codeInputFieldStyle, codeInputHighlightStyle, secureTextEntry, pinCount } = this.props
        const { defaultTextFieldStyle } = styles
        const { selectedIndex, digits } = this.state
        return (
            <View key={index + "view"}>
                <TextInput
                    underlineColorAndroid='rgba(0,0,0,0)'
                    style={selectedIndex === index ? [defaultTextFieldStyle, codeInputFieldStyle, codeInputHighlightStyle] : [defaultTextFieldStyle, codeInputFieldStyle]}
                    ref={ref => { this.fields[index] = ref }}
                    onChangeText={text => {
                        this.handleChangeText(index, text)
                    }}
                    onKeyPress={({ nativeEvent: { key } }) => { this.handleKeyPressTextInput(index, key) }}
                    value={digits[index]}
                    keyboardType="number-pad"
                    textContentType= {isAutoFillSupported ? "oneTimeCode" : "none"}
                    key={index}
                    selectionColor="#00000000"
                    secureTextEntry={secureTextEntry}
                    onFocus={() => {
                        if (this.props.isFocused) {
                            let filledPinCount = digits.filter((digit) => { return (digit !== null && digit !== undefined) }).length
                            if (filledPinCount !== pinCount) this.focusField(Math.min(filledPinCount, pinCount - 1))
                        }
                        
                    }}
                />
            </View>
        )
    }

    renderTextFields = () => {
        const { pinCount } = this.props
        const array = new Array(pinCount).fill(0)
        return array.map(this.renderOneInputField)
    }

    render() {
        const { pinCount, style } = this.props
        const digits = this.getDigits()
        return (
            <View
                style={style}
            >
                <TouchableWithoutFeedback
                    style={{ width: '100%', height: '100%' }}
                    onPress={() => {
                        let filledPinCount = digits.filter((digit) => { return (digit !== null && digit !== undefined) }).length
                        this.focusField(Math.min(filledPinCount, pinCount - 1))
                    }}
                >
                    <View
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', height: '100%' }}
                    >
                        {this.renderTextFields()}
                    </View>
                </TouchableWithoutFeedback>
            </View>
        );
    }
}