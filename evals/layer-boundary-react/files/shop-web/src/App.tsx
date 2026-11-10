import {OrderList} from '@/features/orders/components/OrderList'
import {UserName} from '@/features/users/components/UserName'

export function App() {
  return <main><UserName id="me" /><OrderList /></main>
}
