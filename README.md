# Interior Design Modification App

This web application allows users to redesign interior spaces using AI-powered image generation. Users can upload room images, define areas to modify using masks, and apply different design styles or custom prompts.

## Features

- Upload your interior images or provide image URLs
- Create custom masks to specify areas for redesign
- Choose from predefined design styles (Modern, Scandinavian, Industrial, etc.)
- Enter custom design prompts for unique modifications
- Real-time image processing using FAL AI models or local FLUX model
- Download generated design images

## Tech Stack

- **Backend**: Python with Flask
- **Frontend**: HTML, CSS, JavaScript
- **AI Models**: 
  - FAL AI models (Ideogram and Flux)
  - Local FLUX Controlnet Inpainting model
- **Package Manager**: UV (modern, faster Python package manager)

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd home-interior-ai
   ```

2. Install UV (if you don't have it already):
   ```
   curl -fsSL https://astral.sh/uv/install.sh | bash
   ```
   
   Or on macOS with Homebrew:
   ```
   brew install uv
   ```

3. Create a virtual environment and install dependencies with UV:
   ```
   uv venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   uv add flask fal-client
   ```

4. Set up your FAL AI API credentials:
   ```
   export FAL_KEY=your_api_key
   ```

## Usage

1. Start the server:
   ```
   uv run server.py
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:5001
   ```

3. Upload an interior image, create a mask (or upload one), select a design style or enter a custom prompt, and click "Run" to generate your new design.

## Project Structure

- `server.py` - Flask server and API integration
- `static/` - Static assets
  - `static/css/style.css` - Main stylesheet
  - `static/js/app.js` - Frontend application logic
  - `images/` - Contains generated images and thumbnails
- `templates/` - HTML templates
  - `templates/index.html` - Main application page

## Design Styles

The application includes several predefined interior design styles:
- Modern
- Scandinavian
- Industrial
- Mid-Century Modern
- Indian Traditional
- Bohemian
- Luxury

## License

MIT License