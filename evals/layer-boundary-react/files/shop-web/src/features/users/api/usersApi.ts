import {http} from '@/shared/api/http'

export type User = {id: string; name: string}

export const fetchUser = (id: string) => http<User>(`/api/users/${id}`)
