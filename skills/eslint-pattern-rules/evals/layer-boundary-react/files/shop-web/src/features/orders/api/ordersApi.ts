import {http} from '@/shared/api/http'

export type Order = {id: string; total: number; status: 'open' | 'shipped'}

export const fetchOrders = () => http<Order[]>('/api/orders')
export const cancelOrder = (id: string) => http<void>(`/api/orders/${id}`, {method: 'DELETE'})
