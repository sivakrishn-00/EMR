from django.core.files.storage import Storage
from django.core.files.base import ContentFile
from django.utils.deconstruct import deconstructible
from pymongo import MongoClient
import gridfs
from bson.objectid import ObjectId
from django.conf import settings

@deconstructible
class MongoGridFSStorage(Storage):
    def __init__(self):
        self.client = None
        self.db = None
        self.fs = None
        self.connect()

    def connect(self):
        if not self.client:
            try:
                self.client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=2000)
                self.db = self.client[settings.MONGO_DB_NAME]
                self.fs = gridfs.GridFS(self.db, collection='patient_proofs')
            except Exception:
                pass

    def _open(self, name, mode='rb'):
        self.connect()
        try:
            grid_out = self.fs.get(ObjectId(name))
            return ContentFile(grid_out.read(), name=name)
        except Exception:
            try:
                grid_out = self.fs.find_one({"filename": name})
                if grid_out:
                    return ContentFile(grid_out.read(), name=name)
            except Exception:
                pass
            return None

    def _save(self, name, content):
        self.connect()
        content_type = getattr(content, 'content_type', 'image/jpeg')
        
        # Check if the uploaded file is an image
        if content_type.startswith('image/') or name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            try:
                from PIL import Image
                import io

                # Open the image using Pillow
                img = Image.open(content)
                
                # Convert RGBA/LA/P to RGB (converting to WebP requires RGB)
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize if the image is too large (max 800px width/height for HD screens)
                max_size = 800
                if img.width > max_size or img.height > max_size:
                    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                
                # Compress and convert to WebP format in memory
                output = io.BytesIO()
                img.save(output, format='WebP', quality=90)
                output.seek(0)
                
                # Use the compressed WebP data
                file_data = output.read()
                filename = name.rsplit('.', 1)[0] + '.webp'
                content_type = 'image/webp'
            except Exception as e:
                # If compression fails, fall back to the original content
                content.seek(0)
                file_data = content.read()
                filename = name
        else:
            file_data = content.read()
            filename = name

        # Upload binary stream to GridFS
        file_id = self.fs.put(file_data, filename=filename, contentType=content_type)
        return str(file_id)

    def exists(self, name):
        self.connect()
        try:
            return self.fs.exists(ObjectId(name))
        except Exception:
            return self.fs.exists({"filename": name})

    def url(self, name):
        if not name:
            return ""
        # Returns the API endpoint that serves the MongoDB GridFS binary data
        return f"/api/patients/mongo-media/{name}/"

    def delete(self, name):
        self.connect()
        try:
            self.fs.delete(ObjectId(name))
        except Exception:
            pass
