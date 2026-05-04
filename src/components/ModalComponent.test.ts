import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import ModalComponent from './ModalComponent.vue'

const ionicStubs = {
  IonModal: {
    props: ['isOpen'],
    emits: ['didDismiss'],
    template: '<div data-testid="modal" :data-open="isOpen" @dismiss="$emit(\'didDismiss\')"><slot /></div>',
  },
  IonHeader: { template: '<header><slot /></header>' },
  IonToolbar: { template: '<div><slot /></div>' },
  IonTitle: { template: '<h1><slot /></h1>' },
  IonContent: { template: '<section><slot /></section>' },
  IonItem: { template: '<label><slot /></label>' },
  IonLabel: { template: '<span><slot /></span>' },
  IonButtons: { template: '<div><slot /></div>' },
  IonButton: {
    name: 'IonButton',
    emits: ['click'],
    template: '<button @click="$emit(\'click\', $event)"><slot /></button>',
  },
  IonInput: {
    name: 'IonInput',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}

function mountModal(props: {
  isOpen?: boolean
  modalType?: 'add' | 'default'
  title?: string
} = {}) {
  return mount(ModalComponent, {
    props: {
      isOpen: true,
      modalType: 'add',
      title: 'Add instance',
      ...props,
    },
    global: {
      plugins: [i18n],
      stubs: ionicStubs,
    },
  })
}

describe('ModalComponent', () => {
  it('emits normalized instance data for add mode and closes itself', async () => {
    const wrapper = mountModal()
    const inputs = wrapper.findAll('input')

    await inputs[0]?.setValue('  Yaju Tube  ')
    await inputs[1]?.setValue(' https://video.example//nested/ ')
    await wrapper.findAll('button').at(1)?.trigger('click')

    expect(wrapper.emitted('save')?.[0]).toEqual([
      {
        name: 'Yaju Tube',
        url: 'video.example/nested',
      },
    ])
    expect(wrapper.emitted('update:isOpen')?.[0]).toEqual([false])
  })

  it('emits only a normalized URL in default-instance mode', async () => {
    const wrapper = mountModal({
      modalType: 'default',
      title: 'Default instance',
    })

    expect(wrapper.findAll('input')).toHaveLength(1)

    await wrapper.get('input').setValue('http://default.example///')
    await wrapper.findAll('button').at(1)?.trigger('click')

    expect(wrapper.emitted('save')?.[0]).toEqual([
      {
        url: 'default.example',
      },
    ])
  })

  it('resets inputs when reopened and closes when dismissed', async () => {
    const wrapper = mountModal({ isOpen: false })

    await wrapper.setProps({ isOpen: true })
    await wrapper.get('input').setValue('Temporary name')
    expect(wrapper.get('input').element.value).toBe('Temporary name')

    await wrapper.setProps({ isOpen: false })
    await wrapper.setProps({ isOpen: true })
    expect(wrapper.get('input').element.value).toBe('')

    await wrapper.get('[data-testid="modal"]').trigger('dismiss')

    expect(wrapper.emitted('update:isOpen')?.at(-1)).toEqual([false])
  })
})
