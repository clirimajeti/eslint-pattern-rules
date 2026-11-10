import {useUser} from '../hooks/useUser'

export function UserName({id}: {id: string}) {
  const user = useUser(id)
  return <span>{user?.name ?? '...'}</span>
}
