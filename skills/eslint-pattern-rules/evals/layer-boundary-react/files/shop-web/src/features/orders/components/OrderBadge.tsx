import {useEffect, useState} from 'react'
import {fetchOrders} from '@/features/orders/api/ordersApi'

export function OrderBadge() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    fetchOrders().then((o) => setCount(o.filter((x) => x.status === 'open').length))
  }, [])
  return <span>{count}</span>
}
