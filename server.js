import { app } from './src/app.js'

const PORT = process.env.PORT || 5000

// No host argument: Node listens on "::" (IPv6 + IPv4) when available, which
// Railway's private network needs (the frontend's nginx reaches us over IPv6).
app.listen(PORT, () => {
  console.log(`🚀 API listening on port ${PORT}`)
})
