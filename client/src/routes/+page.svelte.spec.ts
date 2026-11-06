import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Home from './+page.svelte';

const mocks = vi.hoisted(() => ({
	authStore: {
		record: null as { id: string; phone: string } | null,
		onChange: vi.fn(),
		clear: vi.fn()
	},
	collection: vi.fn(),
	getFullList: vi.fn(),
	create: vi.fn(),
	authWithPassword: vi.fn(),
	authListener: null as
		((token: string, record: { id: string; phone: string } | null) => void) | null
}));

vi.mock('pocketbase', () => ({
	default: class PocketBaseMock {
		authStore = mocks.authStore;
		collection = mocks.collection;
	}
}));

const signInButton = () => page.getByRole('button', { name: 'Đăng nhập' }).nth(1);
const phoneInput = () => page.getByRole('textbox', { name: 'Số điện thoại' });
const passwordInput = () => page.getByRole('textbox', { name: 'Mật khẩu', exact: true });
const confirmPasswordInput = () => page.getByRole('textbox', { name: 'Xác nhận mật khẩu' });
const signupSubmitButton = () => page.getByRole('button', { name: 'Tạo tài khoản' }).last();
const signupModeButton = () => page.getByRole('button', { name: 'Tạo tài khoản' }).first();

async function submitLogin(phone: string, password: string) {
	await phoneInput().fill(phone);
	await passwordInput().fill(password);
	await signInButton().click();
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise;
	});

	return { promise, resolve };
}

describe('trang tài khoản', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.authStore.record = null;
		mocks.authListener = null;
		mocks.authStore.onChange.mockImplementation((callback) => {
			mocks.authListener = callback;
			return () => {
				mocks.authListener = null;
			};
		});
		mocks.authStore.clear.mockImplementation(() => {
			mocks.authStore.record = null;
			mocks.authListener?.('', null);
		});
		mocks.collection.mockImplementation(() => ({
			getFullList: mocks.getFullList,
			create: mocks.create,
			authWithPassword: mocks.authWithPassword
		}));
		mocks.getFullList.mockResolvedValue([]);
		mocks.create.mockResolvedValue({});
		mocks.authWithPassword.mockImplementation(async () => {
			const user = { id: 'user-1', phone: '+84912345678' };
			mocks.authStore.record = user;
			mocks.authListener?.('token', user);
			return user;
		});
	});

	it('shows the login view by default', async () => {
		render(Home);

		await expect.element(page.getByRole('heading', { name: 'Chào mừng trở lại.' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Đăng nhập' }).first())
			.toHaveAttribute('aria-pressed', 'true');
	});

	it('shows phone and password fields without confirmation on login', async () => {
		render(Home);

		await expect.element(phoneInput()).toBeVisible();
		await expect.element(passwordInput()).toBeVisible();
		await expect.element(confirmPasswordInput()).not.toBeInTheDocument();
	});

	it('switches to signup and displays a confirmation field', async () => {
		render(Home);
		await signupSubmitButton().click();

		await expect.element(page.getByRole('heading', { name: 'Bắt đầu từ đây.' })).toBeVisible();
		await expect.element(confirmPasswordInput()).toBeVisible();
	});

	it('clears entered passwords when switching account mode', async () => {
		render(Home);
		await signupSubmitButton().click();
		await passwordInput().fill('password123');
		await confirmPasswordInput().fill('password123');
		await page.getByRole('button', { name: 'Đăng nhập' }).first().click();

		await expect.element(passwordInput()).toHaveValue('');
	});

	it('rejects signup when the password confirmation does not match', async () => {
		render(Home);
		await signupSubmitButton().click();
		await phoneInput().fill('0912345678');
		await passwordInput().fill('password123');
		await confirmPasswordInput().fill('different123');
		await signupSubmitButton().click();

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Mật khẩu xác nhận không khớp.');
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it('rejects an invalid Vietnamese phone number', async () => {
		render(Home);
		await submitLogin('01234', 'password123');

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Vui lòng nhập số điện thoại hợp lệ');
		expect(mocks.authWithPassword).not.toHaveBeenCalled();
	});

	it('rejects an invalid international phone number', async () => {
		render(Home);
		await submitLogin('+0 12345678', 'password123');

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Vui lòng nhập số điện thoại hợp lệ');
		expect(mocks.authWithPassword).not.toHaveBeenCalled();
	});

	it('normalizes a Vietnamese phone number before login', async () => {
		render(Home);
		await submitLogin('0912 345 678', 'password123');

		await expect.element(page.getByRole('heading', { name: 'Phòng của bạn.' })).toBeVisible();
		expect(mocks.authWithPassword).toHaveBeenCalledWith('+84912345678', 'password123');
	});

	it('removes supported formatting from an international number', async () => {
		render(Home);
		await submitLogin(' +1 (202) 555-0123 ', 'password123');

		expect(mocks.authWithPassword).toHaveBeenCalledWith('+12025550123', 'password123');
	});

	it('shows a server-provided login error', async () => {
		mocks.authWithPassword.mockRejectedValue({ response: { message: 'Sai mật khẩu.' } });
		render(Home);
		await submitLogin('+84912345678', 'wrongpass');

		await expect.element(page.getByRole('alert')).toHaveTextContent('Sai mật khẩu.');
	});

	it('loads the signed-in account and its rooms after login', async () => {
		mocks.getFullList.mockResolvedValue([
			{ id: 'room-1', name: 'Phòng A', code: 'A01', active: true }
		]);
		render(Home);
		await submitLogin('+84912345678', 'password123');

		await expect.element(page.getByRole('heading', { name: 'Phòng của bạn.' })).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Phòng A' })).toBeVisible();
		expect(mocks.getFullList).toHaveBeenCalledWith({ sort: 'name' });
	});

	it('creates a signup with normalized phone and signs in', async () => {
		render(Home);
		await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
		await phoneInput().fill('0912-345-678');
		await passwordInput().fill('password123');
		await confirmPasswordInput().fill('password123');
		await signupSubmitButton().click();

		expect(mocks.create).toHaveBeenCalledWith({
			phone: '+84912345678',
			email: '',
			password: 'password123',
			passwordConfirm: 'password123'
		});
		await expect.element(page.getByRole('heading', { name: 'Phòng của bạn.' })).toBeVisible();
	});

	it('asks the user to log in if signup succeeds but automatic login fails', async () => {
		mocks.authWithPassword.mockRejectedValue(new Error('authentication unavailable'));
		render(Home);
		await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
		await phoneInput().fill('0912345678');
		await passwordInput().fill('password123');
		await confirmPasswordInput().fill('password123');
		await signupSubmitButton().click();

		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Tạo tài khoản thành công. Vui lòng đăng nhập để tiếp tục.');
		await expect.element(page.getByRole('heading', { name: 'Chào mừng trở lại.' })).toBeVisible();
	});

	it('shows an account-creation error', async () => {
		mocks.create.mockRejectedValue({ response: { message: 'Số điện thoại đã được sử dụng.' } });
		render(Home);
		await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
		await phoneInput().fill('0912345678');
		await passwordInput().fill('password123');
		await confirmPasswordInput().fill('password123');
		await signupSubmitButton().click();

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Số điện thoại đã được sử dụng.');
	});

	it('shows a helpful message when the account has no assigned rooms', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		render(Home);

		await expect
			.element(
				page.getByText('Chưa có phòng được gán cho tài khoản này. Vui lòng liên hệ quản trị viên.')
			)
			.toBeVisible();
	});

	it('displays room-loading errors', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockRejectedValue({ response: { message: 'Không thể tải phòng.' } });
		render(Home);

		await expect.element(page.getByRole('alert')).toHaveTextContent('Không thể tải phòng.');
	});

	it('shows room name, code, and active status', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockResolvedValue([
			{ id: 'room-1', name: 'Phòng họp', code: 'A01', active: true }
		]);
		render(Home);

		await expect.element(page.getByRole('heading', { name: 'Phòng họp' })).toBeVisible();
		await expect.element(page.getByText('Mã phòng: A01')).toBeVisible();
		await expect.element(page.getByText('Sẵn sàng')).toBeVisible();
	});

	it('hides an absent room code and disables unlock for inactive rooms', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockResolvedValue([
			{ id: 'room-2', name: 'Phòng bảo trì', code: '', active: false }
		]);
		render(Home);

		await expect.element(page.getByText('Đang tạm ngưng')).toBeVisible();
		await expect.element(page.getByText('Mã phòng:')).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Mở khóa phòng Phòng bảo trì' }))
			.toBeDisabled();
	});

	it('sends an unlock command for an active room', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockResolvedValue([
			{ id: 'room-1', name: 'Phòng A', code: '', active: true }
		]);
		render(Home);
		await page.getByRole('button', { name: 'Mở khóa phòng Phòng A' }).click();

		expect(mocks.create).toHaveBeenCalledWith({
			room: 'room-1',
			requestedBy: 'user-1',
			action: 'unlock'
		});
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Đã gửi lệnh mở khóa phòng Phòng A.');
	});

	it('reports an unlock-command failure', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockResolvedValue([
			{ id: 'room-1', name: 'Phòng A', code: '', active: true }
		]);
		mocks.create.mockRejectedValue({ response: { message: 'Thiết bị đang ngoại tuyến.' } });
		render(Home);
		await page.getByRole('button', { name: 'Mở khóa phòng Phòng A' }).click();

		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Không gửi được lệnh mở khóa: Thiết bị đang ngoại tuyến.');
	});

	it('marks the phone and password fields as required with the expected input types', async () => {
		render(Home);

		await expect.element(phoneInput()).toHaveAttribute('type', 'tel');
		await expect.element(phoneInput()).toHaveAttribute('required');
		await expect.element(passwordInput()).toHaveAttribute('type', 'password');
		await expect.element(passwordInput()).toHaveAttribute('minlength', '8');
	});

	it('updates the selected mode button state when entering signup', async () => {
		render(Home);
		await signupModeButton().click();

		await expect.element(signupModeButton()).toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: 'Đăng nhập' }).first())
			.toHaveAttribute('aria-pressed', 'false');
		await expect.element(page.getByText('Tạo tài khoản để tìm không gian phù hợp.')).toBeVisible();
	});

	it('clears a signup validation error when returning to login mode', async () => {
		render(Home);
		await signupModeButton().click();
		await phoneInput().fill('0912345678');
		await passwordInput().fill('password123');
		await confirmPasswordInput().fill('different123');
		await signupSubmitButton().click();
		await expect.element(page.getByRole('alert')).toBeVisible();
		await page.getByRole('button', { name: 'Đăng nhập' }).first().click();

		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Chào mừng trở lại.' })).toBeVisible();
	});

	it('rejects invalid phone numbers during signup without creating an account', async () => {
		render(Home);
		await signupModeButton().click();
		await phoneInput().fill('1234567890');
		await passwordInput().fill('password123');
		await confirmPasswordInput().fill('password123');
		await signupSubmitButton().click();

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Vui lòng nhập số điện thoại hợp lệ');
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it('uses a fallback message for login errors without a server response', async () => {
		mocks.authWithPassword.mockRejectedValue(new Error('offline'));
		render(Home);
		await submitLogin('+84912345678', 'password123');

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Không thể kết nối. Vui lòng thử lại sau.');
	});

	it('uses a fallback message for signup errors without a server response', async () => {
		mocks.create.mockRejectedValue(new Error('offline'));
		render(Home);
		await signupModeButton().click();
		await phoneInput().fill('0912345678');
		await passwordInput().fill('password123');
		await confirmPasswordInput().fill('password123');
		await signupSubmitButton().click();

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Không thể kết nối. Vui lòng thử lại sau.');
	});

	it('clears a previous login error after a successful retry', async () => {
		mocks.authWithPassword.mockRejectedValueOnce({ response: { message: 'Sai mật khẩu.' } });
		render(Home);
		await submitLogin('+84912345678', 'password123');
		await expect.element(page.getByRole('alert')).toBeVisible();
		await passwordInput().fill('correct-password');
		await signInButton().click();

		await expect.element(page.getByRole('heading', { name: 'Phòng của bạn.' })).toBeVisible();
		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
	});

	it('disables the login submit button while authentication is pending', async () => {
		const authentication = deferred<{ id: string; phone: string }>();
		mocks.authWithPassword.mockImplementation(() =>
			authentication.promise.then((user) => {
				mocks.authStore.record = user;
				mocks.authListener?.('token', user);
				return user;
			})
		);
		render(Home);
		await phoneInput().fill('+84912345678');
		await passwordInput().fill('password123');
		await signInButton().click();

		const pendingButton = page.getByRole('button', { name: 'Đang xử lý…' });
		await expect.element(pendingButton).toBeDisabled();
		authentication.resolve({ id: 'user-1', phone: '+84912345678' });
		await expect.element(page.getByRole('heading', { name: 'Phòng của bạn.' })).toBeVisible();
	});

	it('shows the signed-in user phone number', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		render(Home);

		await expect.element(page.getByText('+84912345678')).toBeVisible();
	});

	it('reloads rooms when the refresh button is clicked', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList
			.mockResolvedValueOnce([{ id: 'room-1', name: 'Phòng cũ', code: '', active: true }])
			.mockResolvedValueOnce([{ id: 'room-2', name: 'Phòng mới', code: '', active: true }]);
		render(Home);
		await expect.element(page.getByRole('heading', { name: 'Phòng cũ' })).toBeVisible();
		await page.getByRole('button', { name: 'Tải lại' }).click();

		await expect.element(page.getByRole('heading', { name: 'Phòng mới' })).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Phòng cũ' })).not.toBeInTheDocument();
		expect(mocks.getFullList).toHaveBeenCalledTimes(2);
	});

	it('shows the initial room-loading state and disables refresh until loading finishes', async () => {
		const roomsRequest = deferred<{ id: string; name: string; code: string; active: boolean }[]>();
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockReturnValue(roomsRequest.promise);
		render(Home);

		await expect.element(page.getByRole('status')).toHaveTextContent('Đang tải danh sách phòng…');
		await expect.element(page.getByRole('button', { name: 'Tải lại' })).toBeDisabled();
		roomsRequest.resolve([]);
		await expect.element(page.getByText('Chưa có phòng được gán cho tài khoản này.')).toBeVisible();
	});

	it('shows loading state during a room refresh and disables repeat refreshes', async () => {
		const roomsRefresh = deferred<{ id: string; name: string; code: string; active: boolean }[]>();
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockResolvedValueOnce([
			{ id: 'room-1', name: 'Phòng A', code: '', active: true }
		]);
		render(Home);
		await expect.element(page.getByRole('heading', { name: 'Phòng A' })).toBeVisible();
		mocks.getFullList.mockReturnValueOnce(roomsRefresh.promise);
		await page.getByRole('button', { name: 'Tải lại' }).click();

		await expect.element(page.getByRole('status')).toHaveTextContent('Đang tải danh sách phòng…');
		await expect.element(page.getByRole('button', { name: 'Tải lại' })).toBeDisabled();
		roomsRefresh.resolve([]);
	});

	it('recovers from a room-loading error after refreshing', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList
			.mockRejectedValueOnce({ response: { message: 'Không thể tải phòng.' } })
			.mockResolvedValueOnce([{ id: 'room-1', name: 'Phòng đã tải lại', code: '', active: true }]);
		render(Home);
		await expect.element(page.getByRole('alert')).toHaveTextContent('Không thể tải phòng.');
		await page.getByRole('button', { name: 'Tải lại' }).click();

		await expect.element(page.getByRole('heading', { name: 'Phòng đã tải lại' })).toBeVisible();
		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
	});

	it('clears the signed-in account and room list after sign out', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockResolvedValue([
			{ id: 'room-1', name: 'Phòng riêng', code: '', active: true }
		]);
		render(Home);
		await expect.element(page.getByRole('heading', { name: 'Phòng riêng' })).toBeVisible();
		await page.getByRole('button', { name: 'Đăng xuất' }).click();

		expect(mocks.authStore.clear).toHaveBeenCalledOnce();
		await expect.element(page.getByRole('heading', { name: 'Chào mừng trở lại.' })).toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Phòng riêng' }))
			.not.toBeInTheDocument();
	});

	it('ignores a room response that arrives after signing out', async () => {
		const roomsRequest = deferred<{ id: string; name: string; code: string; active: boolean }[]>();
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockReturnValue(roomsRequest.promise);
		render(Home);
		await expect.element(page.getByRole('status')).toBeVisible();
		await page.getByRole('button', { name: 'Đăng xuất' }).click();
		roomsRequest.resolve([
			{ id: 'room-1', name: 'Phòng không được hiển thị', code: '', active: true }
		]);

		await expect
			.element(page.getByRole('heading', { name: 'Phòng không được hiển thị' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Chào mừng trở lại.' })).toBeVisible();
	});

	it('prevents commands for other rooms while an unlock is pending', async () => {
		const unlockRequest = deferred<object>();
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockResolvedValue([
			{ id: 'room-1', name: 'Phòng A', code: '', active: true },
			{ id: 'room-2', name: 'Phòng B', code: '', active: true }
		]);
		mocks.create.mockReturnValue(unlockRequest.promise);
		render(Home);
		await page.getByRole('button', { name: 'Mở khóa phòng Phòng A' }).click();

		await expect
			.element(page.getByRole('button', { name: 'Mở khóa phòng Phòng A' }))
			.toHaveTextContent('Đang gửi…');
		await expect
			.element(page.getByRole('button', { name: 'Mở khóa phòng Phòng B' }))
			.toBeDisabled();
		expect(mocks.create).toHaveBeenCalledOnce();
		unlockRequest.resolve({});
	});

	it('uses a fallback message when an unlock request has no server response', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockResolvedValue([
			{ id: 'room-1', name: 'Phòng A', code: '', active: true }
		]);
		mocks.create.mockRejectedValue(new Error('offline'));
		render(Home);
		await page.getByRole('button', { name: 'Mở khóa phòng Phòng A' }).click();

		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Không gửi được lệnh mở khóa: Không thể kết nối. Vui lòng thử lại sau.');
	});

	it('clears an unlock result when the authentication record changes', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockResolvedValue([
			{ id: 'room-1', name: 'Phòng A', code: '', active: true }
		]);
		render(Home);
		await page.getByRole('button', { name: 'Mở khóa phòng Phòng A' }).click();
		await expect.element(page.getByRole('status')).toBeVisible();
		mocks.authListener?.('new-token', { id: 'user-2', phone: '+84987654321' });

		await expect.element(page.getByRole('status')).not.toBeInTheDocument();
		await expect.element(page.getByText('+84987654321')).toBeVisible();
	});

	it('clears the password after signing out', async () => {
		render(Home);
		await phoneInput().fill('+84912345678');
		await passwordInput().fill('password123');
		await signInButton().click();
		await expect.element(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
		await page.getByRole('button', { name: 'Đăng xuất' }).click();

		await expect.element(passwordInput()).toHaveValue('');
	});

	it('uses a fallback message for room-loading errors without a server response', async () => {
		mocks.authStore.record = { id: 'user-1', phone: '+84912345678' };
		mocks.getFullList.mockRejectedValue(new Error('offline'));
		render(Home);

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Không thể kết nối. Vui lòng thử lại sau.');
	});
});
