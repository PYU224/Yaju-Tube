import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { useInstanceStore } from '@/stores/instanceStore'
import { useSettingsStore } from '@/stores/settingsStore'
import Tab3Page from './Tab3Page.vue'

const ionicStubs = {
  IonPage: { template: '<main><slot /></main>' },
  IonHeader: { template: '<header><slot /></header>' },
  IonToolbar: { template: '<div><slot /></div>' },
  IonTitle: { template: '<h1><slot /></h1>' },
  IonContent: { template: '<section><slot /></section>' },
  IonList: { template: '<div><slot /></div>' },
  IonItem: {
    name: 'IonItem',
    emits: ['click'],
    template: '<div role="button" @click="$emit(\'click\', $event)"><slot /></div>',
  },
  IonLabel: { template: '<span><slot /></span>' },
  IonSelect: {
    name: 'IonSelect',
    props: ['modelValue'],
    emits: ['update:modelValue', 'ionChange'],
    template: '<select><slot /></select>',
  },
  IonSelectOption: { template: '<option><slot /></option>' },
  IonToggle: {
    name: 'IonToggle',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
  },
  IonAlert: { template: '<div data-testid="about-alert" />' },
  ModalComponent: {
    name: 'ModalComponent',
    props: ['isOpen', 'modalType', 'title'],
    emits: ['update:isOpen', 'save'],
    template: `
      <div data-testid="settings-modal" :data-open="isOpen" :data-type="modalType">
        <h2>{{ title }}</h2>
        <button data-testid="modal-close" @click="$emit('update:isOpen', false)">close</button>
        <button data-testid="modal-save-add" @click="$emit('save', { name: '  Custom Instance  ', url: ' https://video.example ' })">save add</button>
        <button data-testid="modal-save-add-url-name" @click="$emit('save', { name: '   ', url: ' https://fallback.example ' })">save add fallback</button>
        <button data-testid="modal-save-default" @click="$emit('save', { url: 'https://default.example/' })">save default</button>
      </div>
    `,
  },
}

function selectAt(wrapper: ReturnType<typeof mount>, index: number) {
  const select = wrapper.findAllComponents({ name: 'IonSelect' }).at(index)
  expect(select).toBeTruthy()
  return select
}

async function mountTab3Page(setupSettings?: (settingsStore: ReturnType<typeof useSettingsStore>) => void) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const settingsStore = useSettingsStore()
  const instanceStore = useInstanceStore()
  setupSettings?.(settingsStore)

  const wrapper = mount(Tab3Page, {
    global: {
      plugins: [pinia, i18n],
      stubs: ionicStubs,
    },
  })
  await wrapper.vm.$nextTick()

  return { instanceStore, settingsStore, wrapper }
}

describe('Tab3Page', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.removeAttribute('data-theme')
    i18n.global.locale.value = 'ja'
  })

  it('renders settings and applies the saved theme on mount', async () => {
    const { wrapper } = await mountTab3Page((settingsStore) => {
      settingsStore.theme = 'dark'
    })

    expect(wrapper.get('h1').text()).toBe(i18n.global.t('menu.settings'))
    expect(wrapper.text()).toContain(i18n.global.t('menu.setItems'))
    expect(wrapper.text()).toContain(i18n.global.t('menu.setThemes'))
    expect(wrapper.text()).toContain(i18n.global.t('menu.setLanguage'))
    expect(document.body.getAttribute('data-theme')).toBe('dark')
  })

  it('updates page size, theme, notifications, and language preferences', async () => {
    const { settingsStore, wrapper } = await mountTab3Page()
    const itemsSelect = selectAt(wrapper, 0)
    const themeSelect = selectAt(wrapper, 1)
    const languageSelect = selectAt(wrapper, 2)

    itemsSelect?.vm.$emit('update:modelValue', 30)
    await wrapper.vm.$nextTick()

    themeSelect?.vm.$emit('update:modelValue', 'grape')
    themeSelect?.vm.$emit('ionChange', { detail: { value: 'grape' } })
    await wrapper.vm.$nextTick()

    wrapper.getComponent({ name: 'IonToggle' }).vm.$emit('update:modelValue', false)
    await wrapper.vm.$nextTick()

    languageSelect?.vm.$emit('update:modelValue', 'de')
    languageSelect?.vm.$emit('ionChange', { detail: { value: 'de' } })
    await wrapper.vm.$nextTick()

    expect(settingsStore.itemsPerPage).toBe(30)
    expect(settingsStore.theme).toBe('grape')
    expect(document.body.getAttribute('data-theme')).toBe('grape')
    expect(settingsStore.notificationsEnabled).toBe(false)
    expect(settingsStore.locale).toBe('de')
    expect(i18n.global.locale.value).toBe('de')
  })

  it('sets the default instance URL through the default-instance modal', async () => {
    const { settingsStore, wrapper } = await mountTab3Page()
    const defaultItem = wrapper
      .findAll('[role="button"]')
      .find((item) => item.text().includes(i18n.global.t('menu.setDefaultInstance')))

    expect(defaultItem).toBeTruthy()
    await defaultItem?.trigger('click')

    expect(wrapper.get('[data-testid="settings-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.get('[data-testid="settings-modal"]').attributes('data-type')).toBe('default')
    expect(wrapper.text()).toContain(i18n.global.t('modal.title.default'))

    await wrapper.get('[data-testid="modal-save-default"]').trigger('click')

    expect(settingsStore.defaultInstanceUrl).toBe('default.example/')
  })

  it('adds instances through the add-instance modal and closes the modal when requested', async () => {
    const { instanceStore, wrapper } = await mountTab3Page()
    const addItem = wrapper
      .findAll('[role="button"]')
      .find((item) => item.text().includes(i18n.global.t('menu.addInstance')))

    expect(addItem).toBeTruthy()
    await addItem?.trigger('click')

    expect(wrapper.get('[data-testid="settings-modal"]').attributes('data-open')).toBe('true')
    expect(wrapper.get('[data-testid="settings-modal"]').attributes('data-type')).toBe('add')
    expect(wrapper.text()).toContain(i18n.global.t('modal.title.add'))

    await wrapper.get('[data-testid="modal-save-add"]').trigger('click')
    await wrapper.get('[data-testid="modal-save-add-url-name"]').trigger('click')

    expect(instanceStore.instances).toEqual([
      {
        name: 'Custom Instance',
        url: 'video.example',
      },
      {
        name: 'https://fallback.example',
        url: 'fallback.example',
      },
    ])

    await wrapper.get('[data-testid="modal-close"]').trigger('click')

    expect(wrapper.get('[data-testid="settings-modal"]').attributes('data-open')).toBe('false')
  })
})
