import type {Order} from '../api/ordersApi'

export function OrderRow({order, onCancel}: {order: Order; onCancel: () => void}) {
  return <li>{order.id} - {order.total} <button onClick={onCancel}>Cancel</button></li>
}
