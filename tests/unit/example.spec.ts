import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Tab1Page from '@/views/Tab1Page.vue'
import i18n from '@/i18n'
import { useInstanceStore } from '@/stores/instanceStore'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, test } from 'vitest'

async function mountTab1Page() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const instanceStore = useInstanceStore()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tabs/tab1', component: { template: '<div />' } },
      { path: '/tabs/tab2', component: { template: '<div />' } },
    ],
  })
  await router.push('/tabs/tab1')
  await router.isReady()

  const wrapper = mount(Tab1Page, {
    global: {
      plugins: [pinia, router, i18n],
      stubs: {
        IonPage: { template: '<main><slot /></main>' },
        IonHeader: { template: '<header><slot /></header>' },
        IonToolbar: { template: '<div><slot /></div>' },
        IonTitle: { template: '<h1><slot /></h1>' },
        IonContent: { template: '<section><slot /></section>' },
        IonList: { template: '<ul><slot /></ul>' },
        IonItem: { template: '<li><slot /></li>' },
        IonLabel: { template: '<span><slot /></span>' },
        IonItemSliding: { template: '<div><slot /></div>' },
        IonItemOptions: { template: '<div><slot /></div>' },
        IonItemOption: { template: '<button><slot /></button>' },
      },
    },
  })

  return { instanceStore, router, wrapper }
}

describe('Tab1Page.vue', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('renders saved instances', async () => {
    const { instanceStore, wrapper } = await mountTab1Page()
    instanceStore.addInstance({ name: 'Yaju Tube', url: '810video.com' })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Yaju Tube')
  })

  test('selects an instance and navigates to the video list', async () => {
    const { instanceStore, router, wrapper } = await mountTab1Page()
    instanceStore.addInstance({ name: 'Yaju Tube', url: '810video.com' })
    await wrapper.vm.$nextTick()

    await wrapper.get('li').trigger('click')
    await flushPromises()

    expect(instanceStore.selectedInstanceUrl).toBe('810video.com')
    expect(router.currentRoute.value.fullPath).toBe('/tabs/tab2')
  })

  test('removes an instance from the list', async () => {
    const { instanceStore, wrapper } = await mountTab1Page()
    instanceStore.addInstance({ name: 'Yaju Tube', url: '810video.com' })
    await wrapper.vm.$nextTick()

    await wrapper.get('button').trigger('click')

    expect(instanceStore.instances).toEqual([])
  })
})
