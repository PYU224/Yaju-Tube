<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('upload.title') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <!-- ログインフォーム -->
      <template v-if="!authStore.isLoggedIn">
        <ion-list>
          <ion-item>
            <ion-label position="stacked">{{ $t('auth.host') }}</ion-label>
            <ion-input v-model="host" />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">{{ $t('auth.username') }}</ion-label>
            <ion-input v-model="username" />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">{{ $t('auth.password') }}</ion-label>
            <ion-input
              v-model="password"
              type="password"
            />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">{{ $t('auth.otp') }}</ion-label>
            <ion-input v-model="otp" />
          </ion-item>
        </ion-list>

        <ion-button
          expand="block"
          aria-label="login"
          :disabled="loggingIn"
          @click="onLogin"
        >
          {{ $t('auth.login') }}
        </ion-button>

        <div
          v-if="loginError"
          class="login-error"
        >
          {{ loginError }}
        </div>
      </template>

      <!-- アップロードフォーム -->
      <template v-else>
        <div class="logged-in-as">
          {{ $t('auth.loggedInAs', { name: authStore.username }) }}
        </div>
        <ion-button
          fill="outline"
          aria-label="logout"
          @click="onLogout"
        >
          <ion-icon
            slot="start"
            :icon="logOut"
          />
          {{ $t('auth.logout') }}
        </ion-button>

        <ion-list>
          <ion-item v-if="authStore.channels.length > 0">
            <ion-label position="stacked">{{ $t('upload.selectChannel') }}</ion-label>
            <ion-select v-model="selectedChannelId">
              <ion-select-option
                v-for="channel in authStore.channels"
                :key="channel.id"
                :value="channel.id"
              >
                {{ channel.displayName }}
              </ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item v-else>
            <ion-label>{{ $t('upload.noChannels') }}</ion-label>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">{{ $t('upload.selectFile') }}</ion-label>
            <input
              type="file"
              accept="video/*"
              data-testid="file-input"
              @change="onFileChange"
            />
          </ion-item>

          <ion-item>
            <ion-label position="stacked">{{ $t('upload.videoName') }}</ion-label>
            <ion-input v-model="name" />
          </ion-item>

          <ion-item>
            <ion-label position="stacked">{{ $t('upload.description') }}</ion-label>
            <ion-textarea v-model="description" />
          </ion-item>

          <ion-item>
            <ion-label position="stacked">{{ $t('upload.privacy') }}</ion-label>
            <ion-select v-model="privacy">
              <ion-select-option :value="VIDEO_PRIVACY.PUBLIC">{{ $t('upload.privacyPublic') }}</ion-select-option>
              <ion-select-option :value="VIDEO_PRIVACY.UNLISTED">{{ $t('upload.privacyUnlisted') }}</ion-select-option>
              <ion-select-option :value="VIDEO_PRIVACY.PRIVATE">{{ $t('upload.privacyPrivate') }}</ion-select-option>
              <ion-select-option :value="VIDEO_PRIVACY.INTERNAL">{{ $t('upload.privacyInternal') }}</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-list>

        <ion-button
          expand="block"
          aria-label="start-upload"
          :disabled="uploading"
          @click="onStartUpload"
        >
          <ion-icon
            slot="start"
            :icon="cloudUpload"
          />
          {{ $t('upload.start') }}
        </ion-button>

        <template v-if="uploading">
          <ion-progress-bar :value="progress" />
          <ion-button
            expand="block"
            color="danger"
            aria-label="cancel-upload"
            @click="onCancel"
          >
            {{ $t('upload.cancel') }}
          </ion-button>
        </template>

        <div
          v-if="uploadedUuid"
          class="upload-success"
        >
          {{ $t('upload.success') }}
          <ion-button
            aria-label="view-video"
            @click="onViewVideo"
          >
            {{ $t('upload.viewVideo') }}
          </ion-button>
        </div>

        <div
          v-if="uploadError"
          class="upload-error"
        >
          {{ uploadError }}
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonProgressBar,
} from '@ionic/vue';
import { cloudUpload, logOut } from 'ionicons/icons';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useInstanceStore } from '@/stores/instanceStore';
import {
  login,
  getMyAccount,
  uploadVideo,
  VIDEO_PRIVACY,
  PeerTubeAuthError,
} from '@/api/peertube';
import type { VideoPrivacy } from '@/api/peertube';

const authStore = useAuthStore();
const instanceStore = useInstanceStore();
const router = useRouter();
const { t } = useI18n();

// ログインフォームの状態
const host = ref(instanceStore.selectedInstanceUrl);
const username = ref('');
const password = ref('');
const otp = ref('');
const loggingIn = ref(false);
const loginError = ref('');

// アップロードフォームの状態
const selectedChannelId = ref<number | undefined>(authStore.channels[0]?.id);
const selectedFile = ref<File | null>(null);
const name = ref('');
const description = ref('');
const privacy = ref<VideoPrivacy>(VIDEO_PRIVACY.PUBLIC);
const uploading = ref(false);
const progress = ref(0);
const uploadedUuid = ref('');
const uploadError = ref('');
let abortController: AbortController | null = null;

async function onLogin() {
  loginError.value = '';
  loggingIn.value = true;
  try {
    const result = await login({
      host: host.value,
      username: username.value,
      password: password.value,
      ...(otp.value ? { otpToken: otp.value } : {}),
    });
    const account = await getMyAccount({
      host: host.value,
      token: result.accessToken,
    });
    authStore.setSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenType: result.tokenType,
      username: account.username,
      host: host.value,
      channels: account.channels,
    });
    selectedChannelId.value = account.channels[0]?.id;
  } catch (error) {
    if (error instanceof PeerTubeAuthError) {
      if (error.code === 'invalid_grant') {
        loginError.value = t('auth.invalidCredentials');
      } else if (error.code === 'missing_two_factor') {
        loginError.value = t('auth.twoFactorRequired');
      } else if (error.code === 'invalid_two_factor') {
        loginError.value = t('auth.invalidTwoFactor');
      } else {
        loginError.value = t('auth.networkError');
      }
    } else {
      loginError.value = t('auth.networkError');
    }
  } finally {
    loggingIn.value = false;
  }
}

function onLogout() {
  authStore.logout();
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  selectedFile.value = file;
  if (file) {
    name.value = file.name.replace(/\.[^/.]+$/, '');
  }
}

async function onStartUpload() {
  uploadError.value = '';
  uploadedUuid.value = '';

  if (!selectedFile.value) {
    uploadError.value = t('upload.selectFileFirst');

    return;
  }
  if (!name.value.trim()) {
    uploadError.value = t('upload.nameRequired');

    return;
  }

  abortController = new AbortController();
  uploading.value = true;
  progress.value = 0;
  try {
    const result = await uploadVideo({
      host: authStore.host as string,
      token: authStore.accessToken as string,
      file: selectedFile.value,
      name: name.value,
      channelId: selectedChannelId.value as number,
      privacy: privacy.value,
      description: description.value,
      signal: abortController.signal,
      onProgress: (uploaded: number, total: number) => {
        progress.value = total ? uploaded / total : 0;
      },
    });
    uploadedUuid.value = result.uuid;
  } catch {
    uploadError.value = t('upload.failed');
  } finally {
    uploading.value = false;
  }
}

function onCancel() {
  abortController?.abort();
}

function onViewVideo() {
  sessionStorage.setItem('tempInstanceUrl', authStore.host as string);
  router.push(`/tabs/video/${uploadedUuid.value}`);
}
</script>

<style scoped>
.login-error,
.upload-error {
  margin: 1rem 0;
  padding: 0.75rem;
  color: var(--ion-color-danger);
  border: 1px solid var(--ion-color-danger);
  border-radius: 4px;
}

.upload-success {
  margin: 1rem 0;
  padding: 0.75rem;
  color: var(--ion-color-success);
  border: 1px solid var(--ion-color-success);
  border-radius: 4px;
}

.logged-in-as {
  margin-bottom: 0.5rem;
  font-weight: 600;
}

ion-progress-bar {
  margin: 1rem 0;
}
</style>
