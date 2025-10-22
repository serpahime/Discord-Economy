const price = {
    role: 25000,
    role_7dprod: 1000,
    role_color: 3500,
    role_name: 15000,
    role_icon: 35000,
    hide_gender: {
        "1d": 5000,
        "1w": 17000,
        "1m": 35000,
        "male_id_role": "1392920324970123424",
        "female_id_role": "1392920769385992335"
    },
    admin: {
        "1d": 125000,
        "3d": 250000,
        "7d": 500000,
        "admin_id_role": "1098580952114016306"
    },
    marry: 7500,
    marry7prod: 1500,
    marry_nameroom: 7500,
    marry_role_id: "1377317976570593365",
    room: 30000,
    room_7dprod: 2500,
    room_color: 7500,
    room_name: 5000
}

const create = {
    role: "999609135127605273"
}

const cfg = {
    timely: 150,
    donat_channel: "1337457561213075466",
    privates: {
        "settings_channel_id": "1369003038131490918",
        "join_voice_id": "1369004028775633061",
        "block_roles": ["999609135257636921", "1000236966979305533", "999609134922092627", "1392924533261865050"]
    },
    marry: {
        "join_voice_id": "1213918576646295612",
        "block_roles": ["999609135257636921", "1000236966979305533", "999609134922092627", "1392924533261865050"],
        "male_role_id": "1392920324970123424",
        "female_role_id": "1392920769385992335"
    },
    online: {
        "online_category_id": ["999609136415244397", "1098571358390198344"], // Указываем несколько категорий для учета онлайна
        "skip_voice_categories_ids": [],
        "marry_category_id": "1032413395221225512",
        "skip_marry_categories_ids": ["1213918576646295612"]
    },
    room_create: {
        "room_category_id": "999609137228939285",
        "block_roles": ["999609135257636921", "1000236966979305533", "999609134922092627", "1392924533261865050"],
        "role_pos_create": "1186330135562039317"
    },
    chat: {
        "idchannel": "1188148632478826514",
        "block_roles": ["999609135257636921", "1000236966979305533", "999609134922092627"], // Последняя роль мут чата
    },
    apanel: {
        "allowed_users": ["1370102381441978510"]
    }
}

module.exports = { price, create, cfg };