import axios from 'axios'

const apiClient = axios.create({
	baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
	headers: { 'Content-Type': 'application/json' },
	timeout: 120_000
})

export default apiClient
