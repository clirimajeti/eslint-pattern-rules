import {useOrders} from '../hooks/useOrders'
import {OrderRow} from './OrderRow'

export function OrderList() {
  const {orders, cancel} = useOrders()
  return <ul>{orders.map((o) => <OrderRow key={o.id} order={o} onCancel={() => cancel(o.id)} />)}</ul>
}
