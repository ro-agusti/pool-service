<script lang="ts">
  import { page } from '$app/state'

  const email = $derived($page.url.searchParams.get('email') ?? '')
</script>

<div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">

    <div class="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-6">
      <svg class="w-8 h-8 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    </div>

    <h1 class="text-xl font-semibold text-slate-900 mb-2">Check your email</h1>

    <p class="text-slate-500 text-sm mb-6">
      We sent a confirmation link to<br>
      <strong class="text-slate-800">{email}</strong>.<br><br>
      Click the link to activate your account and log in.
    </p>

    <div class="bg-slate-50 rounded-xl p-4 text-xs text-slate-400 mb-6">
      Didn't receive it? Check your spam folder.
    </div>

    <a href="/" class="text-sky-500 text-sm hover:underline">
  Back to home
</a>

  </div>
</div>