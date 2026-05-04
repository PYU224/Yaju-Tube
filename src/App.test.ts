import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from './App.vue'

describe('App', () => {
  it('renders the Ionic app shell with a router outlet', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          IonApp: { template: '<div data-testid="ion-app"><slot /></div>' },
          IonRouterOutlet: { template: '<div data-testid="router-outlet" />' },
        },
      },
    })

    expect(wrapper.find('[data-testid="ion-app"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="router-outlet"]').exists()).toBe(true)
  })
})
