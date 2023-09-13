
/** authentication process
 * signUp/register: create new account (add user to database)
 *   (email, new username, new password)
 * 
 * signIn/logIn: lets say we have multipli devices
 *   first login: (email / username, password)
 *   subsequent login's: cookie (session based / jsonWebToken)
 * 
 * signOut/logOut: remove cookie (session based / jsonWebToken)
 * 
 * delete account: remove user from database
 */

/** security notes
 * sessions are statefull (server store it)
 * stored in secure httpOnlyt cookie (no access to client js)
 * ⚠️ cookie can manual accessed (devTools/application/cookies)
 */

import express from 'express'
import bcrypt from 'bcrypt'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import {
  addUser,
  getUsers,
  hasUser,
  deleteUser
} from '../users.js'

// can be stored in database, but in memory faster !!
const SESSIONS = new Map()

const app = express()

app.use(express.json())
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))
app.use(cookieParser())

// get users ...........................................
app.get('/users', (req, res) => res.json(getUsers()))

// register / signUp ...................................
app.post('/register', async (req, res) => {
  const { username, password, email, role } = req.body

  const unAvailable = hasUser({ username })
  if (unAvailable)
    return res.status(409) // Conflict
      .send(`sorry, the username ${username} already taken`)

  // hachedPw will be prefixed with salt with length of 10
  const hachedPw = await bcrypt.hash(password, 10)
  const id = crypto.randomUUID()

  const newUser = { id, username, hachedPw, email, role }
  addUser(newUser)

  res.send(`${username} registered as ${role} !`)

  const time = new Date().toLocaleString()
  console.log(`${username} registered as ${role} at ${time}`)
  console.log(`hached password: ${hachedPw}`)
})

// logIn / signIn ......................................
app.post('/login', async (req, res) => {
  const { username, password } = req.body

  const user = getUsers({ username })
  if (!user)
    return res.status(401)
      .send(`Cannot login, ${username} are not registered !`)

  const { hachedPw } = user
  const validPw = await bcrypt.compare(password, hachedPw)
  if (!validPw)
    return res.status(401)
      .send(`Cannot login, Invalid password !`)

  const sessionId = crypto.randomUUID()
  SESSIONS.set(sessionId, user.id)

  res.cookie('sessionId', sessionId, {
    secure: true,
    httpOnly: true,
    sameSite: 'none', // for test purposes
  }).send(`${username} logged-in successfully`)

  const time = new Date().toLocaleString()
  console.log(`${username} logged-in at ${time}`)
  console.log(`sessionId: ${sessionId}`)
})

// logOut / signOut ....................................
app.delete('/logout', sessionAuthentication, (req, res) => {
  const { sessionId } = req.cookies
  SESSIONS.delete(sessionId)
  res.clearCookie('sessionId')

  const { id } = req.user
  const user = getUsers({ id })
  const { username } = user
  res.send(`${username} logged out seccessfully`)
  console.log(`${username} logged out seccessfully`)
})

// delete account ......................................
app.delete('/deleteAccount', sessionAuthentication, (req, res) => {
  const { sessionId } = req.cookies
  SESSIONS.delete(sessionId)
  res.clearCookie('sessionId')

  const { id } = req.user
  const user = getUsers({ id })
  deleteUser({ id })

  const { username } = user
  res.send(`${username} deleted account seccessfully`)
  console.log(`${username} deleted account seccessfully`)
})

// authorization .......................................
app.get('/admin', sessionAuthentication, (req, res) => {
  const { id } = req.user
  const user = getUsers({ id })

  if (user.role !== 'admin')
    return res.status(403) // Forbidden
      .send('sorry, only admin have access')

  const { username } = user
  res.send(`${username} grents admin access`)
  console.log(`${username} grents admin access`)
})

// authentication middleware
function sessionAuthentication(req, res, next) {
  const { sessionId } = req.cookies
  if (!sessionId) return res.sendStatus(401) // Unauthorized

  const id = SESSIONS.get(sessionId)
  if (!id) return res.sendStatus(401) // Unauthorized

  req.user = { id }

  const user = getUsers({ id })
  const { username } = user
  console.log(`${username} authenticated !`)

  next()
}

app.listen(3000)