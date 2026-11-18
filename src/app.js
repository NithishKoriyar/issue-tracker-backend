import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { apiRouter } from './routes/index.js'
import {
  errorHandler,
  notFoundHandler,
} from './middlewares/error.middleware.js'

export const app = express()

// In production a request passes two proxies: Railway's edge → nginx → API.
// Trusting both hops makes req.ip the real client IP (the rate limiter uses it).
// In dev, Vite's proxy adds no X-Forwarded-For, so req.ip is just the socket.
app.set('trust proxy', 2)

// No CORS middleware on purpose: the browser only ever talks to the
// frontend's origin, which proxies /api here. Cross-origin calls are refused.
app.use(helmet())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.use('/api', apiRouter)

app.use(notFoundHandler)
app.use(errorHandler)
