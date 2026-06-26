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
          :disabled="uploading"
          @click="onLogout"
        >
          <ion-icon
            slot="start"
            :icon="logOut"
          />
          {{ $t('auth.logout') }}
        </ion-button>

        <div
          v-if="pendingUpload && !uploadedUuid"
          class="resume-banner"
        >
          <p>{{ $t('upload.resumeNotice', { name: pendingUpload.name }) }}</p>
          <ion-button
            size="small"
            aria-label="resume-upload"
            :disabled="uploading || !canResume"
            @click="onResume"
          >
            {{ $t('upload.resume') }}
          </ion-button>
          <ion-button
            size="small"
            color="medium"
            aria-label="discard-upload"
            :disabled="uploading"
            @click="discardPending"
          >
            {{ $t('upload.discard') }}
          </ion-button>
        </div>

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
          :disabled="uploading || selectedChannelId === undefined || pendingUpload !== null"
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
            v-if="canViewUploaded"
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
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useInstanceStore } from '@/stores/instanceStore';
import { useUploadStore } from '@/stores/uploadStore';
import {
  login,
  getMyAccount,
  uploadVideo,
  resumeUpload,
  cancelUpload,
  refreshAccessToken,
  normalizeHost,
  VIDEO_PRIVACY,
  PeerTubeAuthError,
} from '@/api/peertube';
import type { VideoPrivacy } from '@/api/peertube';

const authStore = useAuthStore();
const instanceStore = useInstanceStore();
const uploadStore = useUploadStore();
const router = useRouter();
const { t } = useI18n();

// 30 秒のマージンを持って期限切れ前にトークンを更新
const TOKEN_REFRESH_MARGIN_MS = 30 * 1000;

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
const uploadedPrivacy = ref<VideoPrivacy | null>(null);
const uploadError = ref('');

// Private/Internal videos can't be opened through the unauthenticated public
// embed player, so only offer "View video" for Public/Unlisted uploads.
const canViewUploaded = computed(
  () =>
    uploadedPrivacy.value === VIDEO_PRIVACY.PUBLIC ||
    uploadedPrivacy.value === VIDEO_PRIVACY.UNLISTED,
);
let abortController: AbortController | null = null;
let currentUploadId: string | null = null;

async function onLogin() {
  loginError.value = '';
  loggingIn.value = true;
  // Persist the host without scheme/trailing slash so flows that re-prefix
  // 'https://' (video player, listings) don't produce 'https://https://...'.
  const normalizedHost = normalizeHost(host.value);
  try {
    const result = await login({
      host: normalizedHost,
      username: username.value,
      password: password.value,
      ...(otp.value ? { otpToken: otp.value } : {}),
    });
    const account = await getMyAccount({
      host: normalizedHost,
      token: result.accessToken,
    });
    authStore.setSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenType: result.tokenType,
      clientId: result.clientId,
      clientSecret: result.clientSecret,
      expiresAt: result.expiresIn ? Date.now() + result.expiresIn * 1000 : null,
      username: account.username,
      host: normalizedHost,
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

// 現在ログイン中のインスタンス・アカウントに紐づく、未完了のアップロード。
// 共有端末で別アカウントが同一ホストにログインしても他人の保留は表示しない。
const pendingUpload = computed(() =>
  authStore.host
    ? uploadStore.pendingFor(authStore.host, authStore.username ?? '')
    : null,
);

// 再開には、中断時と同じファイル(名前・サイズ・更新日時が一致)の再選択が必要。
// 別ファイルの混入による破損を防ぐ。
const canResume = computed(() => {
  const p = pendingUpload.value;
  const f = selectedFile.value;
  return (
    !!p &&
    !!f &&
    f.name === p.fileName &&
    f.size === p.fileSize &&
    f.lastModified === p.fileLastModified
  );
});

// 再開対象がある場合は、保存済みのメタデータをフォームへ復元する
if (pendingUpload.value) {
  name.value = pendingUpload.value.name;
  description.value = pendingUpload.value.description;
  privacy.value = pendingUpload.value.privacy as VideoPrivacy;
  selectedChannelId.value = pendingUpload.value.channelId;
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  selectedFile.value = file;
  // 再開待ちのときは保存済みタイトルを尊重し、上書きしない
  if (file && !pendingUpload.value) {
    name.value = file.name.replace(/\.[^/.]+$/, '');
  }
}

// 期限切れが近ければリフレッシュトークンでアクセストークンを更新する。
// 失敗時は呼び出し側で再ログインを促す。
async function ensureValidToken(): Promise<void> {
  const { expiresAt, clientId, clientSecret, refreshToken, host: sessionHost } = authStore;
  if (
    !expiresAt ||
    Date.now() <= expiresAt - TOKEN_REFRESH_MARGIN_MS ||
    !clientId ||
    !clientSecret ||
    !refreshToken ||
    !sessionHost
  ) {
    return;
  }
  const refreshed = await refreshAccessToken({
    host: sessionHost,
    clientId,
    clientSecret,
    refreshToken,
  });
  authStore.applyRefresh({
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    tokenType: refreshed.tokenType,
    expiresAt: refreshed.expiresIn ? Date.now() + refreshed.expiresIn * 1000 : null,
  });
}

async function onStartUpload() {
  // Re-entry guard: a double tap must not start two sessions. Start is also
  // disabled while a pending upload exists (resolve it via Resume/Discard first).
  if (uploading.value || pendingUpload.value) return;
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
  if (selectedChannelId.value === undefined) {
    uploadError.value = t('upload.noChannels');

    return;
  }

  const file = selectedFile.value;
  const channelId = selectedChannelId.value;
  const uploadPrivacy = privacy.value;
  abortController = new AbortController();
  currentUploadId = null;
  // Mark in-flight BEFORE the async refresh so the button disables immediately
  // and a second tap can't enter here during the token refresh.
  uploading.value = true;
  progress.value = 0;

  try {
    await ensureValidToken();
  } catch {
    uploading.value = false;
    authStore.logout();
    // After logout the template shows the login form, so surface the notice there.
    loginError.value = t('auth.sessionExpired');

    return;
  }

  try {
    const result = await uploadVideo({
      host: authStore.host as string,
      token: authStore.accessToken as string,
      file,
      name: name.value,
      channelId,
      privacy: uploadPrivacy,
      description: description.value,
      signal: abortController.signal,
      onInit: (uploadId: string) => {
        currentUploadId = uploadId;
        uploadStore.setPending({
          host: authStore.host as string,
          username: authStore.username ?? '',
          uploadId,
          name: name.value,
          channelId,
          privacy: uploadPrivacy,
          description: description.value,
          fileName: file.name,
          fileSize: file.size,
          fileLastModified: file.lastModified,
          uploadedBytes: 0,
        });
      },
      onProgress: (uploaded: number, total: number) => {
        progress.value = total ? uploaded / total : 0;
        uploadStore.updateProgress(authStore.host as string, authStore.username ?? '', uploaded);
      },
    });
    uploadedUuid.value = result.uuid;
    uploadedPrivacy.value = uploadPrivacy;
    uploadStore.clearPending(authStore.host as string, authStore.username ?? '');
    currentUploadId = null;
  } catch {
    uploadError.value = t('upload.failed');
  } finally {
    uploading.value = false;
  }
}

async function onResume() {
  if (uploading.value) return;
  const pending = pendingUpload.value;
  const file = selectedFile.value;
  if (!pending || !file) return;

  uploadError.value = '';
  uploadedUuid.value = '';

  abortController = new AbortController();
  currentUploadId = pending.uploadId;
  // Mark in-flight before the async refresh (mirrors onStartUpload).
  uploading.value = true;
  progress.value = pending.fileSize ? pending.uploadedBytes / pending.fileSize : 0;

  try {
    await ensureValidToken();
  } catch {
    uploading.value = false;
    currentUploadId = null;
    authStore.logout();
    // After logout the template shows the login form, so surface the notice there.
    loginError.value = t('auth.sessionExpired');

    return;
  }

  try {
    const result = await resumeUpload({
      host: authStore.host as string,
      token: authStore.accessToken as string,
      file,
      uploadId: pending.uploadId,
      signal: abortController.signal,
      onProgress: (uploaded: number, total: number) => {
        progress.value = total ? uploaded / total : 0;
        uploadStore.updateProgress(authStore.host as string, authStore.username ?? '', uploaded);
      },
    });
    uploadedUuid.value = result.uuid;
    uploadedPrivacy.value = pending.privacy as VideoPrivacy;
    uploadStore.clearPending(pending.host, pending.username);
    currentUploadId = null;
  } catch {
    uploadError.value = t('upload.failed');
  } finally {
    uploading.value = false;
  }
}

async function discardPending() {
  if (uploading.value) return;
  const pending = pendingUpload.value;
  if (!pending) return;

  // Refresh first so an expired token doesn't make the cancellation fail and
  // strand the server-side session.
  try {
    await ensureValidToken();
  } catch {
    authStore.logout();
    loginError.value = t('auth.sessionExpired');

    return;
  }

  try {
    await cancelUpload({
      host: authStore.host as string,
      token: authStore.accessToken as string,
      uploadId: pending.uploadId,
    });
    uploadStore.clearPending(pending.host, pending.username);
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      // Already gone server-side — safe to drop the local record.
      uploadStore.clearPending(pending.host, pending.username);
    } else {
      // Keep the pending record so the user still has a resume/discard path.
      uploadError.value = t('upload.failed');
    }
  }
}

async function onCancel() {
  abortController?.abort();

  const uploadId = currentUploadId;
  currentUploadId = null;
  const acctHost = authStore.host as string;
  const acctUser = authStore.username ?? '';

  if (!uploadId) {
    uploadStore.clearPending(acctHost, acctUser);

    return;
  }

  // Keep the pending record until the server-side DELETE actually succeeds, so a
  // failed cancellation still leaves the user a resume/discard path (mirrors
  // discardPending). A 404 means it is already gone.
  try {
    await cancelUpload({ host: acctHost, token: authStore.accessToken as string, uploadId });
    uploadStore.clearPending(acctHost, acctUser);
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      uploadStore.clearPending(acctHost, acctUser);
    }
  }
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

.resume-banner {
  margin: 1rem 0;
  padding: 0.75rem;
  border: 1px solid var(--ion-color-warning);
  border-radius: 4px;
}

.resume-banner p {
  margin: 0 0 0.5rem;
}

ion-progress-bar {
  margin: 1rem 0;
}
</style>
