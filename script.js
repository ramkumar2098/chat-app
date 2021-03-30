const host = location.origin.replace(/(https|http)/, 'wss')
const ws = new WebSocket(host)

const ROOM_ID = window.location.pathname.slice(1)
const USER_ID = uuid()

let doesAnotherUserExist = false

const messageInputElem = document.getElementById('message')

ws.onopen = () => {
  username = prompt('Enter your name') || 'Anonymous'
  emit('NEW_USER', { username, roomId: ROOM_ID })
}

const form = document.getElementById('form')
form.onsubmit = e => {
  e.preventDefault()
  if (ws.readyState !== ws.OPEN || !doesAnotherUserExist) return
  if (!messageInputElem.value.trim()) return
  setIsTyping(false)
  emit('NEW_MESSAGE', { userId: USER_ID, message: messageInputElem.value })
  messageInputElem.value = ''
}

let isTyping = false

const setIsTyping = _isTyping => {
  if (ws.readyState !== ws.OPEN || !doesAnotherUserExist) return
  emit('TYPING', { isTyping: _isTyping })
  isTyping = _isTyping
}

messageInputElem.oninput = () => {
  if (!isTyping) {
    setIsTyping(true)
  } else {
    !messageInputElem.value && setIsTyping(false)
  }
}

const messagesElem = document.getElementById('messages')
let alertElem

ws.onmessage = msg => {
  const data = JSON.parse(msg.data)
  switch (data.type) {
    case 'NEW_USER':
      const { msg } = data.payload
      if (msg == 'wait for someone to join or send this link to someone') {
        alertElem = displayMessage(msg)
      } else {
        messagesElem.removeChild(alertElem)
        displayMessage(msg)
        doesAnotherUserExist = true
        emit('SAY_HELLO')
      }
      break
    case 'SAY_HELLO':
      displayMessage(data.payload.msg)
      doesAnotherUserExist = true
      break
    case 'TYPING':
      if (data.payload.isTyping) {
        const alertElem = displayMessage(data.payload.msg)
        alertElem.id = 'typing'
        scrollToBottom()
      } else {
        const typingElem = document.getElementById('typing')
        messagesElem.removeChild(typingElem)
      }
      break
    case 'NEW_MESSAGE':
      const messageContainer = document.createElement('div')
      messageContainer.className = 'message-container'
      USER_ID === data.payload.userId &&
        (messageContainer.style.justifyContent = 'flex-end')
      const newMessageElem = document.createElement('div')
      newMessageElem.className = 'message-text'
      newMessageElem.textContent = data.payload.message
      messageContainer.appendChild(newMessageElem)
      messagesElem.appendChild(messageContainer)
      scrollToBottom()
      break
    case 'USER_LEFT':
      displayMessage(data.payload.msg)
      doesAnotherUserExist = false
      const typingElem = document.getElementById('typing')
      typingElem && messagesElem.removeChild(typingElem)
      scrollToBottom()
  }
}

const displayMessage = msg => {
  const alertElem = document.createElement('em')
  alertElem.className = 'alert'
  alertElem.textContent = msg
  messagesElem.appendChild(alertElem)
  return alertElem
}

const scrollToBottom = () => {
  messagesElem.scrollTo(0, messagesElem.scrollHeight)
}

const emit = (type, payload) => {
  ws.send(JSON.stringify({ type, payload }))
}

function uuid() {
  return (Math.random() + Math.random()).toString().slice(2)
}
