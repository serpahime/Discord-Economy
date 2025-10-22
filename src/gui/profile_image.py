from PIL import Image, ImageDraw, ImageFont
import os
import sys
import json
import requests
from io import BytesIO

def create_circular_mask(size):
    width, height = size
    mask = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, width, height), fill=255)
    return mask

class ProfileImageGenerator:
    def __init__(self):
        # Получаем путь к текущей директории (gui)
        self.gui_path = os.path.dirname(__file__)
        
        # Настраиваем пути к ресурсам
        self.root_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.resources_path = os.path.join(self.root_path, 'resources')
        self.output_path = os.path.join(self.resources_path, 'output')
        
        # Создаём папки, если они не существуют
        os.makedirs(self.output_path, exist_ok=True)
        
        # Путь к фоновому изображению профиля
        self.profile_background = os.path.join(self.gui_path, 'prof.png')
        
        # Используем системный шрифт по умолчанию
        try:
            # Для Linux
            self.font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', size=32)
            self.small_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', size=24)
        except OSError:
            try:
                # Для Windows
                self.font = ImageFont.truetype('arial.ttf', size=32)
                self.small_font = ImageFont.truetype('arial.ttf', size=24)
            except OSError:
                # Если не удалось загрузить шрифт, используем шрифт по умолчанию
                self.font = ImageFont.load_default()
                self.small_font = ImageFont.load_default()

    def create_profile_image(self, user_data):
        try:
            # Получаем данные из JSON
            username = user_data['username']
            avatar_url = user_data['avatarUrl']
            user_id = user_data['id']
            
            # Проверяем существование файла profile.png
            if not os.path.exists(self.profile_background):
                raise FileNotFoundError(f"Файл фона не найден: {self.profile_background}")
            
            # Загружаем фоновое изображение
            background = Image.open(self.profile_background).convert('RGBA')
            
            # Размеры и позиция аватарки
            avatar_size = (378, 366)
            avatar_pos = (216, 174)
            
            # Загружаем аватар пользователя
            response = requests.get(avatar_url)
            avatar = Image.open(BytesIO(response.content))
            # Изменяем размер аватара
            avatar = avatar.resize(avatar_size)
            
            # Создаем маску для круглой формы
            mask = create_circular_mask(avatar_size)
            
            # Конвертируем аватар в RGBA
            avatar = avatar.convert('RGBA')
            
            # Применяем маску к аватару
            avatar.putalpha(mask)
            
            # Вставляем круглый аватар на фон
            background.paste(avatar, avatar_pos, avatar)
            
            # Создаем объект для рисования
            draw = ImageDraw.Draw(background)
            
            # Добавляем информацию на изображение
            draw.text(
                (100, 50),
                username,
                font=self.font,
                fill=(255, 255, 255)  # Белый цвет
            )
            
            # Здесь вы можете использовать user_id или другие данные
            # для получения дополнительной информации о пользователе
            
            # Сохраняем изображение
            output_file = os.path.join(self.output_path, f'profile_{username}.png')
            background.save(output_file, 'PNG')
            return True, "Успешно"
            
        except Exception as e:
            error_message = f"Ошибка при создании изображения: {str(e)}"
            print(error_message)
            return False, error_message

def main():
    if len(sys.argv) < 2:
        print("Необходимо передать данные пользователя!")
        sys.exit(1)
        
    try:
        # Получаем JSON данные из аргумента командной строки
        user_data = json.loads(sys.argv[1])
        
        generator = ProfileImageGenerator()
        success, message = generator.create_profile_image(user_data)
        
        if not success:
            print(message)
            sys.exit(1)
        
        sys.exit(0)
    except json.JSONDecodeError as e:
        print(f"Ошибка при разборе JSON данных: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()