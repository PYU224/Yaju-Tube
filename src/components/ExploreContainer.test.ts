import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExploreContainer from './ExploreContainer.vue'

describe('ExploreContainer', () => {
  it('renders the provided name and Ionic documentation link', () => {
    const wrapper = mount(ExploreContainer, {
      props: {
        name: 'Explore PeerTube',
      },
    })
    const link = wrapper.get('a')

    expect(wrapper.get('strong').text()).toBe('Explore PeerTube')
    expect(link.attributes('href')).toBe('https://ionicframework.com/docs/components')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })
})
