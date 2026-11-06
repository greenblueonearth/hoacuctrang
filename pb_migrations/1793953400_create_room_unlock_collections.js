migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const rooms = new Collection({
      name: "rooms",
      type: "base",
      listRule:
        '@request.auth.collectionName = "users" && owner = @request.auth.id',
      viewRule:
        '@request.auth.collectionName = "users" && owner = @request.auth.id',
    });
    rooms.fields.add(
      new Field({
        name: "name",
        type: "text",
        required: true,
        max: 100,
      }),
    );
    rooms.fields.add(
      new Field({
        name: "code",
        type: "text",
        max: 40,
      }),
    );
    rooms.fields.add(
      new Field({
        name: "owner",
        type: "relation",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
      }),
    );
    rooms.fields.add(
      new Field({
        name: "active",
        type: "bool",
      }),
    );
    app.save(rooms);

    const devices = new Collection({
      name: "esp32_devices",
      type: "auth",
      authRule: "room.active = true",
    });
    devices.fields.add(
      new Field({
        name: "room",
        type: "relation",
        required: true,
        collectionId: rooms.id,
        maxSelect: 1,
      }),
    );
    devices.fields.add(
      new Field({
        name: "deviceName",
        type: "text",
        max: 100,
      }),
    );
    devices.passwordAuth.identityFields = ["email"];
    app.save(devices);

    const commands = new Collection({
      name: "unlock_commands",
      type: "base",
      listRule:
        '@request.auth.collectionName = "esp32_devices" && room = @request.auth.room && room.active = true',
      viewRule:
        '@request.auth.collectionName = "esp32_devices" && room = @request.auth.room && room.active = true',
      createRule:
        '@request.auth.collectionName = "users" && room.owner = @request.auth.id && room.active = true && requestedBy = @request.auth.id && action = "unlock"',
    });
    commands.fields.add(
      new Field({
        name: "room",
        type: "relation",
        required: true,
        collectionId: rooms.id,
        maxSelect: 1,
      }),
    );
    commands.fields.add(
      new Field({
        name: "requestedBy",
        type: "relation",
        required: true,
        collectionId: users.id,
        maxSelect: 1,
      }),
    );
    commands.fields.add(
      new Field({
        name: "action",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["unlock"],
      }),
    );
    app.save(commands);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("unlock_commands"));
    app.delete(app.findCollectionByNameOrId("esp32_devices"));
    app.delete(app.findCollectionByNameOrId("rooms"));
  },
);
