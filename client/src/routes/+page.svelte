<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';

	const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090');

	let mode = $state<'login' | 'signup'>('login');
	let phone = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let user = $state(pb.authStore.record);
	let busy = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');

	onMount(() => {
		user = pb.authStore.record;
		return pb.authStore.onChange(() => {
			user = pb.authStore.record;
		});
	});

	function changeMode(nextMode: 'login' | 'signup') {
		mode = nextMode;
		errorMessage = '';
		successMessage = '';
		password = '';
		passwordConfirm = '';
	}

	function getErrorMessage(error: unknown) {
		if (error && typeof error === 'object' && 'response' in error) {
			const response = error.response as { message?: string };
			if (response.message) return response.message;
		}

		return 'Không thể kết nối. Vui lòng thử lại sau.';
	}

	function normalizePhone(value: string) {
		const cleaned = value.trim().replace(/[\s().-]/g, '');
		return /^0\d{9}$/.test(cleaned) ? `+84${cleaned.slice(1)}` : cleaned;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		successMessage = '';

		if (mode === 'signup' && password !== passwordConfirm) {
			errorMessage = 'Mật khẩu xác nhận không khớp.';
			return;
		}

		const normalizedPhone = normalizePhone(phone);
		if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
			errorMessage =
				'Vui lòng nhập số điện thoại hợp lệ, gồm mã quốc gia hoặc số Việt Nam bắt đầu bằng 0.';
			return;
		}

		busy = true;
		try {
			if (mode === 'signup') {
				await pb.collection('users').create({
					phone: normalizedPhone,
					email: '',
					password,
					passwordConfirm
				});

				try {
					await pb.collection('users').authWithPassword(normalizedPhone, password);
				} catch {
					changeMode('login');
					successMessage = 'Tạo tài khoản thành công. Vui lòng đăng nhập để tiếp tục.';
				}
			} else {
				await pb.collection('users').authWithPassword(normalizedPhone, password);
			}
		} catch (error) {
			errorMessage = getErrorMessage(error);
		} finally {
			busy = false;
		}
	}

	function signOut() {
		pb.authStore.clear();
		password = '';
		passwordConfirm = '';
	}
</script>

<svelte:head>
	<title>Đăng nhập | Hoa Cúc Trắng</title>
	<meta name="description" content="Đăng nhập hoặc tạo tài khoản Hoa Cúc Trắng." />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Noto+Serif:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main class="page-shell">
	<section class="auth-panel" aria-label="Tài khoản Hoa Cúc Trắng">
		<div class="form-side">
			<a class="brand" href={resolve('/')} aria-label="Hoa Cúc Trắng, trang chủ">
				<span class="brand-mark" aria-hidden="true">H</span>
				<span>HOA CÚC TRẮNG</span>
			</a>

			{#if user}
				<div class="form-content signed-in">
					<p class="eyebrow">TÀI KHOẢN CỦA BẠN</p>
					<h1>Xin chào trở lại.</h1>
					<p class="intro">Bạn đã đăng nhập bằng số điện thoại này:</p>
					<p class="account-phone">{user.phone}</p>
					<button class="primary-button" type="button" onclick={signOut}>Đăng xuất</button>
				</div>
			{:else}
				<div class="form-content">
					<p class="eyebrow">KHÔNG GIAN LÀM VIỆC CỦA BẠN</p>
					<h1>{mode === 'login' ? 'Chào mừng trở lại.' : 'Bắt đầu từ đây.'}</h1>
					<p class="intro">
						{mode === 'login'
							? 'Đăng nhập để tiếp tục hành trình của bạn.'
							: 'Tạo tài khoản để tìm không gian phù hợp.'}
					</p>

					<div class="mode-switch" aria-label="Chọn hình thức tài khoản">
						<button
							class:active={mode === 'login'}
							aria-pressed={mode === 'login'}
							type="button"
							onclick={() => changeMode('login')}>Đăng nhập</button
						>
						<button
							class:active={mode === 'signup'}
							aria-pressed={mode === 'signup'}
							type="button"
							onclick={() => changeMode('signup')}>Tạo tài khoản</button
						>
					</div>

					<form onsubmit={submit}>
						<label for="phone">Số điện thoại</label>
						<input
							id="phone"
							bind:value={phone}
							type="tel"
							inputmode="tel"
							autocomplete="tel"
							placeholder="+84 912 345 678 hoặc 0912 345 678"
							required
						/>
						<p class="field-hint">Số điện thoại sẽ được lưu theo mã quốc gia.</p>

						<label for="password">Mật khẩu</label>
						<input
							id="password"
							bind:value={password}
							type="password"
							autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
							placeholder="Ít nhất 8 ký tự"
							minlength="8"
							required
						/>

						{#if mode === 'signup'}
							<label for="password-confirm">Xác nhận mật khẩu</label>
							<input
								id="password-confirm"
								bind:value={passwordConfirm}
								type="password"
								autocomplete="new-password"
								placeholder="Nhập lại mật khẩu"
								minlength="8"
								required
							/>
						{/if}

						{#if errorMessage}
							<p class="form-message error" role="alert">{errorMessage}</p>
						{/if}
						{#if successMessage}
							<p class="form-message success" role="status">{successMessage}</p>
						{/if}

						<button class="primary-button" type="submit" disabled={busy}>
							{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
						</button>
					</form>

					<p class="terms-note">Bằng việc tiếp tục, bạn đồng ý với các điều khoản sử dụng.</p>
				</div>
			{/if}

			<footer>© 2026 Hoa Cúc Trắng</footer>
		</div>

		<aside class="image-side" aria-label="Không gian làm việc Hoa Cúc Trắng">
			<img
				src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=85"
				alt="Không gian làm việc chung ngập ánh sáng tự nhiên"
			/>
			<div class="image-caption">
				<span class="caption-label">MỘT CHỖ NGỒI, NHIỀU KHẢ NĂNG</span>
				<p>Nơi ý tưởng<br />có chỗ để lớn lên.</p>
			</div>
			<span class="image-credit">Không gian làm việc chung</span>
		</aside>
	</section>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		background: #edf1ec;
		color: #202c27;
		font-family: 'Be Vietnam Pro', sans-serif;
		-webkit-font-smoothing: antialiased;
	}

	.page-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 36px;
	}

	.auth-panel {
		width: min(1100px, 100%);
		min-height: 680px;
		display: grid;
		grid-template-columns: 1fr 0.95fr;
		background: #fff;
		border: 1px solid #dce3dc;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 24px 70px rgb(37 56 43 / 10%);
	}

	.form-side {
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding: 42px clamp(32px, 6vw, 76px) 28px;
	}

	.brand {
		width: fit-content;
		display: inline-flex;
		align-items: center;
		gap: 11px;
		color: #26362e;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 1.1px;
		text-decoration: none;
	}

	.brand-mark {
		width: 34px;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: #e9f0e5;
		color: #396548;
		font-family: 'Noto Serif', Georgia, serif;
		font-size: 21px;
		font-weight: 400;
	}

	.form-content {
		width: 100%;
		max-width: 390px;
		margin: auto;
		padding: 48px 0;
		animation: enter 300ms ease-out both;
	}

	.eyebrow {
		margin: 0 0 12px;
		color: #6b806f;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 1.25px;
	}

	h1 {
		margin: 0;
		color: #26362e;
		font-family: 'Noto Serif', Georgia, serif;
		font-size: clamp(34px, 4vw, 43px);
		font-weight: 400;
		line-height: 1.12;
	}

	.intro {
		margin: 12px 0 28px;
		color: #758078;
		font-size: 14px;
		line-height: 1.65;
	}

	.mode-switch {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
		margin-bottom: 25px;
		padding: 4px;
		border-radius: 5px;
		background: #f1f4f0;
	}

	.mode-switch button {
		min-height: 38px;
		border: 0;
		border-radius: 3px;
		background: transparent;
		color: #78817a;
		font: inherit;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}

	.mode-switch button.active {
		background: #fff;
		color: #315a3e;
		box-shadow: 0 1px 4px rgb(33 47 38 / 10%);
	}

	form {
		display: flex;
		flex-direction: column;
	}

	label {
		margin: 0 0 7px;
		color: #344139;
		font-size: 12px;
		font-weight: 600;
	}

	input {
		width: 100%;
		min-height: 46px;
		margin-bottom: 18px;
		padding: 0 13px;
		border: 1px solid #dce2dc;
		border-radius: 4px;
		background: #fff;
		color: #25332a;
		font: inherit;
		font-size: 13px;
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease;
	}

	input::placeholder {
		color: #a3aaa4;
	}

	input:focus {
		border-color: #588064;
		outline: 0;
		box-shadow: 0 0 0 3px rgb(75 119 87 / 13%);
	}

	.primary-button {
		width: 100%;
		min-height: 48px;
		margin-top: 2px;
		border: 0;
		border-radius: 4px;
		background: #315a3e;
		color: #fff;
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: background 140ms ease;
	}

	.primary-button:hover:not(:disabled) {
		background: #254831;
	}

	.primary-button:disabled {
		cursor: wait;
		opacity: 0.72;
	}

	.form-message {
		margin: -2px 0 15px;
		font-size: 12px;
		line-height: 1.5;
	}

	.error {
		color: #a33e35;
	}

	.success {
		color: #37694a;
	}

	.terms-note {
		margin: 18px 0 0;
		color: #929a93;
		font-size: 10px;
		line-height: 1.6;
		text-align: center;
	}

	.signed-in {
		align-self: center;
	}

	.account-phone {
		margin: 0 0 24px;
		padding: 13px 14px;
		border: 1px solid #e1e7e1;
		border-radius: 4px;
		color: #315a3e;
		font-size: 13px;
		overflow-wrap: anywhere;
	}

	.field-hint {
		margin: -12px 0 18px;
		color: #929a93;
		font-size: 10px;
		line-height: 1.5;
	}

	footer {
		margin-top: auto;
		color: #9aa29b;
		font-size: 10px;
	}

	.image-side {
		position: relative;
		min-height: 100%;
		overflow: hidden;
		background: #354d3c;
	}

	.image-side::after {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgb(18 34 25 / 4%) 28%, rgb(18 34 25 / 72%) 100%);
		content: '';
	}

	.image-side img {
		position: absolute;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}

	.image-caption {
		position: absolute;
		z-index: 1;
		inset: auto 38px 48px;
		color: #fff;
	}

	.caption-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 1.2px;
	}

	.image-caption p {
		margin: 14px 0 0;
		font-family: 'Noto Serif', Georgia, serif;
		font-size: clamp(34px, 4vw, 48px);
		line-height: 1.12;
	}

	.image-credit {
		position: absolute;
		z-index: 1;
		right: 18px;
		bottom: 15px;
		color: rgb(255 255 255 / 72%);
		font-size: 9px;
	}

	@keyframes enter {
		from {
			transform: translateY(7px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@media (max-width: 760px) {
		.page-shell {
			min-height: 100dvh;
			padding: 0;
			background: #fff;
		}

		.auth-panel {
			width: 100%;
			min-height: 100dvh;
			grid-template-columns: 1fr;
			border: 0;
			border-radius: 0;
			box-shadow: none;
		}

		.form-side {
			min-height: 100dvh;
			padding: 26px 25px 22px;
		}

		.form-content {
			max-width: 420px;
			padding: 48px 0;
		}

		.image-side {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 0.01ms !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
