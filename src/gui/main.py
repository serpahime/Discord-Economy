import requests
from PIL import Image
import io
import os

# Ваши данные
FIGMA_TOKEN = 'figd_UNu3brSAHalkGU9AHWNL68ow6UUsKNmO1rAy-dU9'
FILE_KEY = 'YIM0OfUz0fgqrdYOPm9vVz'  # Ключ файла Figma (из URL)
NODE_ID = '24:391'  # ID элемента, который вы хотите изменить
OUTPUT_DIR = 'output_images'  # Папка для сохранения изображений

# Создайте папку для сохранения изображений, если её нет
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# Функция для получения изображения из Figma
def get_figma_image(file_key, node_id, scale=1):
    url = f'https://api.figma.com/v1/images/{file_key}?ids={node_id}&scale={scale}&format=png'
    headers = {'X-FIGMA-TOKEN': FIGMA_TOKEN}
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        image_url = response.json()['images'][node_id]
        image_response = requests.get(image_url)
        return Image.open(io.BytesIO(image_response.content))
    else:
        print(f"Ошибка: {response.status_code}")
        return None


# Функция для изменения ширины элемента
def update_element_width(file_key, node_id, new_width):
    url = f'https://api.figma.com/v1/files/{file_key}/nodes?ids={node_id}'  # Исправленный URL
    headers = {
        'X-FIGMA-TOKEN': FIGMA_TOKEN,
        'Content-Type': 'application/json'
    }
    
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Ошибка получения данных узла: {response.status_code}")
        return

    # Получаем текущие данные узла
    node_data = response.json()
    
    # Формируем URL для обновления
    update_url = f'https://api.figma.com/v1/files/{file_key}'
    
    # Формируем правильную структуру запроса
    payload = {
        "operations": [
            {
                "operation": "RESIZE",
                "options": {
                    "width": new_width,
                    "height": node_data['nodes'][node_id]['document']['absoluteBoundingBox']['height']
                },
                "objectId": node_id
            }
        ]
    }
    
    update_response = requests.patch(update_url, headers=headers, json=payload)
    if update_response.status_code == 200:
        print(f"Ширина изменена на {new_width}")
    else:
        print(f"Ошибка обновления: {update_response.status_code}")
        print(update_response.text)

# Основной цикл
initial_width = 916  # Начальная ширина элемента
for i in range(100):
    # Вычисляем текущий процент (от 100 до 1)
    current_percent = 100 - i
    # Уменьшаем ширину на 1%
    new_width = initial_width * (current_percent / 100)
    update_element_width(FILE_KEY, NODE_ID, new_width)

    # Получаем изображение
    image = get_figma_image(FILE_KEY, NODE_ID)
    if image:
        image.save(f'{OUTPUT_DIR}/{current_percent}.png')  # Сохраняем изображение с процентом в названии
        print(f"Изображение {current_percent}% сохранено")

print("Готово!")