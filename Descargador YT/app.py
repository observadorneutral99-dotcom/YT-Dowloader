from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from ytmusicapi import YTMusic
import yt_dlp
import json
import os
import tempfile
import uuid
import re

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        return {"liked": [], "playlists": {}}

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# Load on startup
data_store = load_data()


app = Flask(__name__, static_folder='static', static_url_path='/')
CORS(app)
ytmusic = YTMusic()

DOWNLOAD_DIR = os.path.join(tempfile.gettempdir(), 'yt_downloads')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def sanitize_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name)

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q')
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    try:
        search_results = ytmusic.search(query, filter="songs", limit=10)
        results = []
        for item in search_results:
            results.append({
                'videoId': item['videoId'],
                'title': item['title'],
                'artists': ', '.join([a['name'] for a in item.get('artists', [])]),
                'duration': item.get('duration', ''),
                'thumbnail': item.get('thumbnails', [{}])[-1].get('url', '')
            })
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download', methods=['POST'])
def download():
    data = request.json
    video_id = data.get('videoId')
    if not video_id:
        return jsonify({'error': 'No videoId provided'}), 400

    url = f"https://music.youtube.com/watch?v={video_id}"
    
    file_id = str(uuid.uuid4())
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'ffmpeg_location': r'C:\Users\user\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin',
        'outtmpl': os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s"),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'noplaylist': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            final_filename = f"{file_id}.mp3"
            
            safe_title = sanitize_filename(info.get('title', 'audio'))
            
            return jsonify({
                'success': True,
                'downloadUrl': f"/api/file?path={final_filename}&title={safe_title}"
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stream', methods=['GET'])
def stream():
    video_id = request.args.get('videoId')
    if not video_id:
        return jsonify({'error': 'No videoId provided'}), 400

    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'noplaylist': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://music.youtube.com/watch?v={video_id}", download=False)
            return jsonify({'url': info['url']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/file', methods=['GET'])
def get_file():
    path = request.args.get('path')
    title = request.args.get('title', 'audio')
    if not path:
        return "No path", 400
        
    full_path = os.path.join(DOWNLOAD_DIR, path)
    if not os.path.exists(full_path):
        return "File not found", 404
        
    return send_file(
        full_path, 
        as_attachment=True, 
        download_name=f"{title}.mp3", 
        mimetype="audio/mpeg"
    )

if __name__ == '__main__':
    app.run(debug=True, port=5000)
