import torch
import base64
import os
import io
from pathlib import Path
from PIL import Image
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from diffusers.utils import load_image
# from diffusers.pipelines import StableDiffusion3ControlNetInpaintingPipeline
# from diffusers.models.controlnets.controlnet_sd3 import SD3ControlNetModel

from controlnet_flux import FluxControlNetModel
from transformer_flux import FluxTransformer2DModel
from pipeline_flux_controlnet_inpaint import FluxControlNetInpaintingPipeline
# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global variables to store the loaded model
pipe = None
controlnet = None
transformer = None 

# Predefined styles with carefully crafted prompts
PREDEFINED_STYLES = {
    "modern": {
        "name": "Modern",
        "prompt": "Transform this area into a sleek modern design with clean lines, neutral colors, minimalist furniture, and subtle lighting. Use contemporary materials like glass, metal, and polished surfaces. Maintain a spacious and uncluttered look.",
    },
    "scandinavian": {
        "name": "Scandinavian",
        "prompt": "Convert this space into a bright Scandinavian style with white walls, light wooden floors, simple functional furniture, and plenty of natural light. Include cozy textiles, muted colors, and touches of greenery for warmth.",
    },
    "industrial": {
        "name": "Industrial",
        "prompt": "Redesign this area with industrial aesthetics featuring exposed brick walls, metal fixtures, weathered wood, and vintage furniture. Add Edison bulbs, open shelving, and raw materials like concrete and steel to create an urban warehouse feel.",
    },
    "mid_century": {
        "name": "Mid-Century Modern",
        "prompt": "Transform this space into a mid-century modern design with iconic furniture shapes, warm wood tones, bold geometric patterns, and pops of color. Include tapered legs, functional forms, and retro-inspired decor from the 1950s-60s era.",
    },
    "indian": {
        "name": "Indian Traditional",
        "prompt": "Redesign this space with rich Indian traditional decor featuring vibrant textiles, intricate patterns, wooden carved furniture, and warm colors like deep reds, oranges, and golds. Add brass accents, decorative pillows, ornate details, archways, and traditional Indian artwork or tapestries.",
    },
    "bohemian": {
        "name": "Bohemian",
        "prompt": "Transform this area with bohemian style featuring layered textiles, eclectic patterns, mixed furniture, macramé, and plenty of plants. Include global-inspired elements, vibrant colors, natural materials, and artistic touches for a free-spirited atmosphere.",
    },
    "luxury": {
        "name": "Luxury",
        "prompt": "Redesign this space with opulent luxury featuring plush velvet furniture, crystal chandeliers, marble surfaces, and gold accents. Create a sophisticated palette with rich colors, symmetrical arrangements, and high-end finishes for an elegant, refined ambiance.",
    }
}

def load_model():
    """Load the SD3 model with ControlNet for inpainting"""
    global pipe, controlnet, transformer
    
    if pipe is None:
        print("Loading SD3 ControlNet model...")
        try:
            # Choose one precision format based on what your GPU supports
            # Most modern NVIDIA GPUs support float16 well
            precision_format = torch.bfloat16
            
            controlnet = FluxControlNetModel.from_pretrained(
                "alimama-creative/FLUX.1-dev-Controlnet-Inpainting-Alpha", 
                torch_dtype=precision_format
            )
            transformer = FluxTransformer2DModel.from_pretrained(
                "black-forest-labs/FLUX.1-dev", 
                subfolder='transformer', 
                torch_dtype=precision_format
            )
            pipe = FluxControlNetInpaintingPipeline.from_pretrained(
                "black-forest-labs/FLUX.1-dev",
                controlnet=controlnet,
                transformer=transformer,
                torch_dtype=precision_format
            )
            # Move models to correct device
            device = "cuda" if torch.cuda.is_available() else "cpu"
            pipe.to(device)
            print(f"Model loaded successfully on {device}")
        except Exception as e:
            print(f"Error loading model: {str(e)}")
            raise e
    return pipe

def decode_base64_to_image(base64_string):
    """Convert base64 string to PIL Image"""
    if base64_string.startswith('data:image'):
        # Remove the data URI prefix
        base64_string = base64_string.split(',')[1]
    
    image_data = base64.b64decode(base64_string)
    return Image.open(io.BytesIO(image_data))

def encode_image_to_base64(image):
    """Convert PIL Image to base64 string"""
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode('utf-8')}"

@app.route('/')
def index():
    """Render the main application page"""
    return render_template('index.html')

@app.route('/get-predefined-styles', methods=['GET'])
def get_predefined_styles():
    """Return the list of predefined styles for the frontend"""
    styles_list = []
    for key, style in PREDEFINED_STYLES.items():
        styles_list.append({
            "id": key,
            "name": style["name"],
        })
    return jsonify(styles_list)

@app.route('/api-status')
def check_api_status():
    """Check if the model is available"""
    try:
        # Just check if we can load the model
        load_model()
        return jsonify({"status": "ok", "device": "cuda" if torch.cuda.is_available() else "cpu"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/generate', methods=['POST'])
def generate_design():
    """Process the user's request and generate a new design using SD3 ControlNet"""
    try:
        # Get form data
        data = request.json
        image_data = data.get('image')
        mask_data = data.get('mask')
        prompt = data.get('prompt')
        selected_style = data.get('style')
        
        # Validate inputs
        if not image_data:
            return jsonify({'error': 'Missing image data'}), 400
        if not mask_data:
            return jsonify({'error': 'Missing mask data'}), 400
        
        # Load model
        pipe = load_model()
        
        # Determine which prompt to use
        final_prompt = prompt
        if selected_style and selected_style in PREDEFINED_STYLES:
            final_prompt = PREDEFINED_STYLES[selected_style]["prompt"]
            print(f"Using predefined style: {PREDEFINED_STYLES[selected_style]['name']}")
        
        # Convert base64 to PIL images
        try:
            control_image = decode_base64_to_image(image_data)
            control_mask = decode_base64_to_image(mask_data)
            
            # Resize images to rectangular format
            width, height = 1280, 768  # Default rectangular size (16:9 aspect ratio)
            control_image = control_image.resize((width, height))
            control_mask = control_mask.resize((width, height))
        except Exception as e:
            print(f"Error processing images: {str(e)}")
            return jsonify({'error': f"Error processing images: {str(e)}"}), 400
        
        # Generate image
        print(f"Generating with prompt: {final_prompt}")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        try:
            generator = torch.Generator(device=device).manual_seed(24)
            result_image = pipe(
                negative_prompt='',
                prompt=final_prompt,
                height=height,
                width=width,
                control_image=control_image,
                control_mask=control_mask,
                num_inference_steps=28,
                generator=generator,
                controlnet_conditioning_scale=0.9,
                guidance_scale=3.5,
                true_guidance_scale=1.0 
            ).images[0]
            
      
            
            # Convert result to base64
            result_base64 = encode_image_to_base64(result_image)
            
            # Return the generated image
            print("Successfully generated image")
            return jsonify({'result_url': result_base64})
        
        except Exception as e:
            print(f"Error generating image: {str(e)}")
            return jsonify({'error': f"Error generating image: {str(e)}"}), 500
            
    except Exception as e:
        print(f"Error in generate_design: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Create directories if they don't exist
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    print("Starting SD3 ControlNet Interior Design API...")
    print("Open your browser and navigate to http://localhost:5002")
    
    # Run the Flask app
    app.run(debug=True, port=5002)
