import {useEffect, useState} from 'react'
import {fetchOrders, cancelOrder, type Order} from '../api/ordersApi'

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  useEffect(() => {
    fetchOrders().then(setOrders)
  }, [])
  const cancel = async (id: string) => {
    await cancelOrder(id)
    setOrders((prev) => prev.filter((o) => o.id !== id))
  }
  return {orders, cancel}
}
