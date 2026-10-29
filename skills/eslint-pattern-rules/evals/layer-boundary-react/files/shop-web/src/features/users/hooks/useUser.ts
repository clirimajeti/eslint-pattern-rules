import {useEffect, useState} from 'react'
import {fetchUser, type User} from '../api/usersApi'

export function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    fetchUser(id).then(setUser)
  }, [id])
  return user
}
