import fal_client
import base64
import os
from pathlib import Path
from flask import Flask, render_template, request, jsonify

# Initialize Flask app
app = Flask(__name__)

# Predefined styles with carefully crafted prompts
PREDEFINED_STYLES = {
    "modern": {
        "name": "Modern",
        "prompt": "Transform this area into a sleek modern design with clean lines, neutral colors, minimalist furniture, and subtle lighting. Use contemporary materials like glass, metal, and polished surfaces. Maintain a spacious and uncluttered look.",
        "model": "fal-ai/ideogram/v3/edit"
    },
    "scandinavian": {
        "name": "Scandinavian",
        "prompt": "Convert this space into a bright Scandinavian style with white walls, light wooden floors, simple functional furniture, and plenty of natural light. Include cozy textiles, muted colors, and touches of greenery for warmth.",
        "model": "fal-ai/ideogram/v3/edit"
    },
    "industrial": {
        "name": "Industrial",
        "prompt": "Redesign this area with industrial aesthetics featuring exposed brick walls, metal fixtures, weathered wood, and vintage furniture. Add Edison bulbs, open shelving, and raw materials like concrete and steel to create an urban warehouse feel.",
        "model": "fal-ai/ideogram/v3/edit"
    },
    "mid_century": {
        "name": "Mid-Century Modern",
        "prompt": "Transform this space into a mid-century modern design with iconic furniture shapes, warm wood tones, bold geometric patterns, and pops of color. Include tapered legs, functional forms, and retro-inspired decor from the 1950s-60s era.",
        "model": "fal-ai/ideogram/v3/edit"
    },
    "indian": {
        "name": "Indian Traditional",
        "prompt": "Redesign this space with rich Indian traditional decor featuring vibrant textiles, intricate patterns, wooden carved furniture, and warm colors like deep reds, oranges, and golds. Add brass accents, decorative pillows, ornate details, archways, and traditional Indian artwork or tapestries.",
        "model": "fal-ai/flux/dev/image-to-image"
    },
    "bohemian": {
        "name": "Bohemian",
        "prompt": "Transform this area with bohemian style featuring layered textiles, eclectic patterns, mixed furniture, macramé, and plenty of plants. Include global-inspired elements, vibrant colors, natural materials, and artistic touches for a free-spirited atmosphere.",
        "model": "fal-ai/flux/dev/image-to-image"
    },
    "luxury": {
        "name": "Luxury",
        "prompt": "Redesign this space with opulent luxury featuring plush velvet furniture, crystal chandeliers, marble surfaces, and gold accents. Create a sophisticated palette with rich colors, symmetrical arrangements, and high-end finishes for an elegant, refined ambiance.",
        "model": "fal-ai/flux/dev/image-to-image"
    }
}

def encode_image_to_base64(image_data):
    """
    Convert a data URI to base64 string with appropriate prefix
    or read a local file and convert it
    """
    # If it's a path to a file
    if isinstance(image_data, str) and os.path.isfile(image_data):
        with open(image_data, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            
            # Determine the file extension and add appropriate data URI prefix
            file_ext = Path(image_data).suffix.lower()
            if file_ext in ['.jpg', '.jpeg']:
                mime_type = 'image/jpeg'
            elif file_ext == '.png':
                mime_type = 'image/png'
            else:
                mime_type = 'image/jpeg'  # Default
                
            return f"data:{mime_type};base64,{encoded_string}"
    
    # If it's already a data URI
    elif isinstance(image_data, str) and image_data.startswith('data:'):
        return image_data
    
    # Default case
    return image_data

def on_queue_update(update):
    """Print progress updates from the API"""
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
            print(log["message"])

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
    """Check if the FAL API is available"""
    try:
        # Make a simple call to the API to check connectivity
        result = fal_client.subscribe(
            "fal-ai/test/echo",
            arguments={
                "message": "ping"
            }
        )
        if result:
            return jsonify({"status": "ok"})
        else:
            return jsonify({"status": "error", "message": "API returned empty response"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/generate', methods=['POST'])
def generate_design():
    """Process the user's request and generate a new design"""
    try:
        # Get form data
        data = request.json
        image_data = data.get('image')
        mask_data = data.get('mask')
        prompt = data.get('prompt')
        selected_style = data.get('style')  # This can be a predefined style ID or None for custom
        
        # Validate inputs
        if not image_data:
            return jsonify({'error': 'Missing image data'}), 400
        
        # Print debug information
        print(f"Received request with prompt: {prompt}")
        print(f"Image data length: {len(image_data)}")
        if mask_data:
            print(f"Mask data length: {len(mask_data)}")
        
        # Determine which model and prompt to use
        model = "fal-ai/ideogram/v3/edit"  # Default model
        final_prompt = prompt
        use_mask = True
        
        if selected_style and selected_style in PREDEFINED_STYLES:
            # Use predefined style
            style_info = PREDEFINED_STYLES[selected_style]
            model = style_info["model"]
            final_prompt = style_info["prompt"]
            print(f"Using predefined style: {style_info['name']} with model: {model}")
            
            # For flux model, no need for mask
            if model == "fal-ai/flux/dev/image-to-image":
                use_mask = False
        
        # Prepare arguments based on the model
        api_args = {
            "image_url": image_data,
            "prompt": final_prompt
        }
        
        # Add mask only if needed and available
        if use_mask and mask_data:
            api_args["mask_url"] = mask_data
        
        # Make API call using the provided images
        print(f"Calling FAL AI API with model: {model}...")
        try:
            result = fal_client.subscribe(
                model,
                arguments=api_args,
                with_logs=True,
                on_queue_update=on_queue_update,
            )
        except Exception as e:
            print(f"Error calling model {model}: {str(e)}")
            return jsonify({
                'error': f"Error generating design with {model}: {str(e)}",
                'details': 'Please try a different style or check your internet connection'
            }), 500
        
        # Extract the result URL - based on the API response format
        print("Got API result:", result)
        
        if 'images' in result and len(result['images']) > 0 and 'url' in result['images'][0]:
            image_url = result['images'][0]['url']
            print("Successfully received image result:", image_url)
            
            # Return the generated image directly without upscaling
            print("Successfully received image result:", image_url)
            return jsonify({'result_url': image_url})
        
        elif 'image' in result:
            # Handle legacy or alternative response format
            print("Successfully received image result (legacy format)")
            image_url = result['image']
            
            # Return the generated image directly without upscaling
            print("Successfully received image result:", image_url)
            return jsonify({'result_url': image_url})
        
        else:
            print("No image in result:", result)
            return jsonify({'error': 'Failed to generate image'}), 500
            
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
    
    print("Starting Interior Design Modification app...")
    print("Open your browser and navigate to http://localhost:5001")
    
    # Run the Flask app
    app.run(debug=True, port=5001)

