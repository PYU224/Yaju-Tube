import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useInstanceStore } from './instanceStore'

describe('instanceStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('loads saved instances from localStorage when the store is created', () => {
    localStorage.setItem(
      'instances',
      JSON.stringify([{ name: 'Saved Instance', url: 'saved.example' }]),
    )

    const store = useInstanceStore()

    expect(store.instances).toEqual([{ name: 'Saved Instance', url: 'saved.example' }])
    expect(store.defaultInstanceUrl).toBe('810video.com')
    expect(store.selectedInstanceUrl).toBe('810video.com')
  })

  it('adds unique instances and ignores duplicate URLs', async () => {
    const store = useInstanceStore()

    store.addInstance({ name: 'Instance 1', url: 'video.example' })
    store.addInstance({ name: 'Duplicate Instance', url: 'video.example' })
    await nextTick()

    expect(store.instances).toEqual([{ name: 'Instance 1', url: 'video.example' }])
    expect(localStorage.getItem('instances')).toBe(
      JSON.stringify([{ name: 'Instance 1', url: 'video.example' }]),
    )
  })

  it('removes instances by URL and persists the updated list', async () => {
    const store = useInstanceStore()
    store.addInstance({ name: 'Instance 1', url: 'one.example' })
    store.addInstance({ name: 'Instance 2', url: 'two.example' })

    store.removeInstance('one.example')
    await nextTick()

    expect(store.instances).toEqual([{ name: 'Instance 2', url: 'two.example' }])
    expect(localStorage.getItem('instances')).toBe(
      JSON.stringify([{ name: 'Instance 2', url: 'two.example' }]),
    )
  })
})
