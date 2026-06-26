import { describe, expect, it } from 'vitest'
import router from './index'

const expectedRoutePaths = [
  '/',
  '/tabs',
  '/tabs/tab1',
  '/tabs/tab2',
  '/tabs/tab3',
  '/tabs/tab4',
  '/tabs/tab5',
  '/tabs/tab6',
  '/tabs/video/:videoId',
]

async function resolveLazyRoute(path: string) {
  const route = router.getRoutes().find((candidate) => candidate.path === path)
  const component = route?.components?.['default']

  if (typeof component !== 'function') {
    expect(component).toBeTruthy()
    return component
  }

  return await (component as () => Promise<unknown>)()
}

describe('router', () => {
  it('registers the expected tab routes', () => {
    const routePaths = router.getRoutes().map((route) => route.path)

    expect(routePaths).toEqual(expect.arrayContaining(expectedRoutePaths))
  })

  it('redirects root and tabs index routes to the video list tab', async () => {
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.fullPath).toBe('/tabs/tab2')

    await router.push('/tabs')
    expect(router.currentRoute.value.fullPath).toBe('/tabs/tab2')
  })

  it('lazy-loads tab and video page route components', async () => {
    await expect(resolveLazyRoute('/tabs/tab1')).resolves.toBeTruthy()
    await expect(resolveLazyRoute('/tabs/tab2')).resolves.toBeTruthy()
    await expect(resolveLazyRoute('/tabs/tab3')).resolves.toBeTruthy()
    await expect(resolveLazyRoute('/tabs/tab4')).resolves.toBeTruthy()
    await expect(resolveLazyRoute('/tabs/tab5')).resolves.toBeTruthy()
    await expect(resolveLazyRoute('/tabs/tab6')).resolves.toBeTruthy()
    await expect(resolveLazyRoute('/tabs/video/:videoId')).resolves.toBeTruthy()
  })
})
