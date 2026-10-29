import {describe, it, expect, vi} from 'vitest'
import * as usersApi from '../api/usersApi'

describe('UserCard', () => {
  it('mocks the api', () => {
    vi.spyOn(usersApi, 'fetchUser').mockResolvedValue({id: '1', name: 'Ada'})
    expect(usersApi.fetchUser).toBeDefined()
  })
})
