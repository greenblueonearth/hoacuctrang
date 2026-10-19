migrate((app) => {
	const users = app.findCollectionByNameOrId('users');
	users.fields.getByName('email').required = false;
	users.fields.add(
		new Field({
			name: 'phone',
			type: 'text',
			required: true,
			max: 16,
			pattern: '^\\+[1-9]\\d{7,14}$'
		})
	);
	users.indexes.push("CREATE UNIQUE INDEX idx_users_phone ON users (phone) WHERE phone != ''");
	users.passwordAuth.identityFields = ['phone'];
	app.save(users);
}, (app) => {
	const users = app.findCollectionByNameOrId('users');
	users.fields.getByName('email').required = true;
	users.fields.removeByName('phone');
	users.indexes = users.indexes.filter((index) => !index.includes('idx_users_phone'));
	users.passwordAuth.identityFields = ['email'];
	app.save(users);
});