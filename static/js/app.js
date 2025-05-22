// Main JavaScript for the interior design app
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const imageUpload = document.getElementById('imageUpload');
    const imageInput = document.getElementById('imageInput');
    const chooseFileBtn = document.getElementById('chooseFileBtn');
    const promptInput = document.getElementById('promptInput');
    const styleSelect = document.getElementById('styleSelect');
    const generateBtn = document.getElementById('generateBtn');
    const loadingContainer = document.getElementById('loading');
    const resultContainer = document.getElementById('resultContainer');
    const resultImage = document.getElementById('resultImage');
    const errorMessage = document.getElementById('errorMessage');
    const saveImageBtn = document.getElementById('saveImageBtn');
    const newDesignBtn = document.getElementById('newDesignBtn');
    
    // Mask elements
    const maskInput = document.getElementById('maskInput');
    const maskUpload = document.getElementById('maskUpload');
    const chooseMaskBtn = document.getElementById('chooseMaskBtn');
    const createMaskBtn = document.getElementById('createMaskBtn');
    const maskModal = document.getElementById('maskModal');
    const closeMaskModal = document.getElementById('closeMaskModal');
    const maskCanvas = document.getElementById('maskCanvas');
    const brushSize = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const downloadMaskBtn = document.getElementById('downloadMaskBtn');
    const useMaskBtn = document.getElementById('useMaskBtn');
    
    // Load predefined styles
    fetch('/get-predefined-styles')
        .then(response => response.json())
        .then(styles => {
            // Clear existing options except the default one
            styleSelect.innerHTML = '<option value="">-- Select a predefined style --</option>';
            
            // Add style options
            styles.forEach(style => {
                const option = document.createElement('option');
                option.value = style.id;
                option.textContent = style.name;
                styleSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error loading styles:', error);
        });
    
    // Handle style selection
    styleSelect.addEventListener('change', function() {
        if (this.value) {
            // If a style is selected, disable custom prompt
            promptInput.disabled = true;
            promptInput.placeholder = 'Using predefined style...';
        } else {
            // If no style is selected, enable custom prompt
            promptInput.disabled = false;
            promptInput.placeholder = 'e.g., Add white sofa and dark brown curtains on window';
        }
    });
    
    // App state
    let originalImage = null;
    let maskImage = null;
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let maskCtx = null;
    let maskHistory = [];
    let maskHistoryIndex = -1;
    
    // Initialize mask canvas
    function initMaskCanvas() {
        maskCtx = maskCanvas.getContext('2d');
        maskCtx.lineJoin = 'round';
        maskCtx.lineCap = 'round';
        maskCtx.lineWidth = parseInt(brushSize.value);
        maskCtx.strokeStyle = 'red'; // Use red for better visibility
        maskCtx.fillStyle = 'red';   // Use red fill for the round brush shape
        
        // Update brush size value display
        brushSizeValue.textContent = brushSize.value + 'px';
    }
    
    // Initialize app
    function init() {
        initMaskCanvas();
        
        // Set up event listeners for file uploads
        chooseFileBtn.addEventListener('click', () => imageUpload.click());
        imageUpload.addEventListener('change', handleImageUpload);
        
        // Set up mask buttons
        chooseMaskBtn.addEventListener('click', () => maskUpload.click());
        maskUpload.addEventListener('change', handleMaskUpload);
        createMaskBtn.addEventListener('click', openMaskEditor);
        closeMaskModal.addEventListener('click', closeMaskEditor);
        
        // Drag and drop for image
        setupDragAndDrop();
        
        // Brush size control
        brushSize.addEventListener('input', updateBrushSize);
        
        // Mask canvas drawing events
        maskCanvas.addEventListener('mousedown', startDrawing);
        maskCanvas.addEventListener('mousemove', draw);
        maskCanvas.addEventListener('mouseup', stopDrawing);
        maskCanvas.addEventListener('mouseout', stopDrawing);
        
        // Touch events for mobile devices
        maskCanvas.addEventListener('touchstart', handleTouchStart);
        maskCanvas.addEventListener('touchmove', handleTouchMove);
        maskCanvas.addEventListener('touchend', stopDrawing);
        maskCanvas.addEventListener('touchcancel', stopDrawing);
        
        // Mask editor buttons
        undoBtn.addEventListener('click', undoMaskEdit);
        redoBtn.addEventListener('click', redoMaskEdit);
        downloadMaskBtn.addEventListener('click', downloadMask);
        useMaskBtn.addEventListener('click', applyMask);
        
        // Generate and download buttons
        generateBtn.addEventListener('click', generateDesign);
        saveImageBtn.addEventListener('click', saveCurrentImage);
        newDesignBtn.addEventListener('click', resetDesign);
        
        // Quick download icon
        const quickDownloadBtn = document.getElementById('quickDownloadBtn');
        if (quickDownloadBtn) {
            quickDownloadBtn.addEventListener('click', saveCurrentImage);
        }
    }
    
    // Setup drag and drop
    function setupDragAndDrop() {
        const dropZones = [document.querySelector('.input-panel')];
        
        dropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });
            
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('drag-over');
            });
            
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                
                if (e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    
                    if (file.type.match('image.*')) {
                        // Update the file input and handle the image
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        imageUpload.files = dataTransfer.files;
                        handleImageFile(file);
                    }
                }
            });
        });
    }
    
    // Handle image URLs
    imageInput.addEventListener('input', function() {
        const url = this.value.trim();
        if (url) {
            loadImageFromUrl(url);
        }
    });
    
    // Handle mask URLs
    maskInput.addEventListener('input', function() {
        const url = this.value.trim();
        if (url) {
            loadMaskFromUrl(url);
        }
    });
    
    // Load image from URL
    function loadImageFromUrl(url) {
        if (!url) return;
        
        showError("Loading image...");
        
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        img.onload = function() {
            errorMessage.textContent = "";
            originalImage = img;
            imageInput.value = url;
            
            // Show preview of the image
            const previewImg = document.createElement('img');
            previewImg.src = url;
            previewImg.className = 'image-preview';
            
            const previewContainer = document.querySelector('.input-field');
            const existingPreview = previewContainer.querySelector('.image-preview');
            
            if (existingPreview) {
                previewContainer.replaceChild(previewImg, existingPreview);
            } else {
                previewContainer.appendChild(previewImg);
            }
        };
        
        img.onerror = function() {
            showError("Error loading image URL. Make sure the URL is correct and the image is accessible.");
        };
        
        img.src = url;
    }
    
    // Load mask from URL
    function loadMaskFromUrl(url) {
        if (!url) return;
        
        showError("Loading mask...");
        
        const img = new Image();
        img.crossOrigin = "Anonymous";
        
        img.onload = function() {
            errorMessage.textContent = "";
            maskImage = img;
            maskInput.value = url;
            
            // Show preview of the mask
            const previewImg = document.createElement('img');
            previewImg.src = url;
            previewImg.className = 'mask-preview';
            
            const previewContainer = document.querySelector('.input-field:nth-child(3)');
            const existingPreview = previewContainer.querySelector('.mask-preview');
            
            if (existingPreview) {
                previewContainer.replaceChild(previewImg, existingPreview);
            } else {
                previewContainer.appendChild(previewImg);
            }
        };
        
        img.onerror = function() {
            showError("Error loading mask URL. Make sure the URL is correct and the image is accessible.");
        };
        
        img.src = url;
    }
    
    // Handle image upload
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        handleImageFile(file);
    }
    
    // Process uploaded image file
    function handleImageFile(file) {
        if (!file.type.match('image.*')) {
            showError('Please upload an image file');
            return;
        }
        
        console.log("File selected:", file.name);
        
        // Display a message that the image is loading
        showError("Loading image...");
        
        const reader = new FileReader();
        
        reader.onload = function(event) {
            console.log("File loaded successfully");
            const img = new Image();
            
            img.onload = function() {
                console.log("Image loaded with dimensions:", img.width, "x", img.height);
                errorMessage.textContent = ""; // Clear the loading message
                
                originalImage = img;
                
                // Update the image URL input field
                imageInput.value = event.target.result;
                
                // Show preview of the image
                const previewImg = document.createElement('img');
                previewImg.src = event.target.result;
                previewImg.className = 'image-preview';
                
                const previewContainer = document.querySelector('.input-field');
                const existingPreview = previewContainer.querySelector('.image-preview');
                
                if (existingPreview) {
                    previewContainer.replaceChild(previewImg, existingPreview);
                } else {
                    previewContainer.appendChild(previewImg);
                }
            };
            
            img.onerror = function() {
                console.error("Error loading image");
                showError("Error loading image. Please try a different file.");
            };
            
            img.src = event.target.result;
        };
        
        reader.onerror = function() {
            console.error("Error reading file");
            showError("Error reading file. Please try again.");
        };
        
        reader.readAsDataURL(file);
    }
    
    // Handle mask upload
    function handleMaskUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.match('image.*')) {
            showError('Please upload an image file for the mask');
            return;
        }
        
        console.log("Mask file selected:", file.name);
        
        // Display a message that the mask is loading
        showError("Loading mask...");
        
        const reader = new FileReader();
        
        reader.onload = function(event) {
            console.log("Mask file loaded successfully");
            const img = new Image();
            
            img.onload = function() {
                console.log("Mask loaded with dimensions:", img.width, "x", img.height);
                errorMessage.textContent = ""; // Clear the loading message
                
                maskImage = img;
                
                // Update the mask URL input field
                maskInput.value = event.target.result;
                
                // Show preview of the mask
                const previewImg = document.createElement('img');
                previewImg.src = event.target.result;
                previewImg.className = 'mask-preview';
                
                const previewContainer = document.querySelector('.input-field:nth-child(3)');
                const existingPreview = previewContainer.querySelector('.mask-preview');
                
                if (existingPreview) {
                    previewContainer.replaceChild(previewImg, existingPreview);
                } else {
                    previewContainer.appendChild(previewImg);
                }
            };
            
            img.onerror = function() {
                console.error("Error loading mask image");
                showError("Error loading mask image. Please try a different file.");
            };
            
            img.src = event.target.result;
        };
        
        reader.onerror = function() {
            console.error("Error reading mask file");
            showError("Error reading mask file. Please try again.");
        };
        
        reader.readAsDataURL(file);
    }
    
    // Open mask editor
    function openMaskEditor() {
        if (!originalImage) {
            showError("Please upload an image first before creating a mask.");
            return;
        }
        
        // Show the modal
        maskModal.classList.remove('hidden');
        
        // Size the canvas to match the image dimensions
        const maxWidth = 800;
        const maxHeight = 600;
        let width = originalImage.width;
        let height = originalImage.height;
        
        if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
        }
        
        if (height > maxHeight) {
            width = (maxHeight / height) * width;
            height = maxHeight;
        }
        
        // Set canvas dimensions
        maskCanvas.width = width;
        maskCanvas.height = height;
        
        // Clear the canvas and draw the original image as reference
        maskCtx.clearRect(0, 0, width, height);
        maskCtx.drawImage(originalImage, 0, 0, width, height);
        
        // Apply a semi-transparent darkening overlay to make it easier to see the mask
        maskCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        maskCtx.fillRect(0, 0, width, height);
        
        // Make sure the brush is visible with pure red color
        maskCtx.strokeStyle = '#FF0000';
        maskCtx.fillStyle = '#FF0000';
        
        // Add text instructions
        maskCtx.font = '16px Arial';
        maskCtx.fillStyle = 'white';
        maskCtx.textAlign = 'center';
        maskCtx.fillText('Draw on areas you want to modify', width/2, 30);
        
        // Reset the history for undo/redo
        maskHistory = [];
        maskHistoryIndex = -1;
        
        // Save the initial state
        saveMaskState();
    }
    
    // Close mask editor
    function closeMaskEditor() {
        maskModal.classList.add('hidden');
    }
    
    // Drawing functions for the mask
    function startDrawing(e) {
        e.preventDefault();
        isDrawing = true;
        const rect = maskCanvas.getBoundingClientRect();
        lastX = e.clientX - rect.left;
        lastY = e.clientY - rect.top;
    }
    
    function handleTouchStart(e) {
        e.preventDefault();
        isDrawing = true;
        const rect = maskCanvas.getBoundingClientRect();
        const touch = e.touches[0];
        lastX = touch.clientX - rect.left;
        lastY = touch.clientY - rect.top;
    }
    
    function draw(e) {
        if (!isDrawing) return;
        
        const rect = maskCanvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        // Make sure we're using a bright red color that's easily detectable
        maskCtx.fillStyle = '#FF0000';  // Pure bright red
        
        // Draw a circle at each point along the path for consistent roundness
        const brushRadius = parseInt(brushSize.value) / 2;
        
        // Calculate points along the path for smoother brush
        const dist = Math.sqrt(Math.pow(currentX - lastX, 2) + Math.pow(currentY - lastY, 2));
        const angle = Math.atan2(currentY - lastY, currentX - lastX);
        
        // For very small movements, just draw a circle
        if (dist < brushRadius/2) {
            maskCtx.beginPath();
            maskCtx.arc(currentX, currentY, brushRadius, 0, Math.PI * 2);
            maskCtx.fill();
        } else {
            // For longer movements, draw circles along the path
            for (let i = 0; i < dist; i += brushRadius/2) {
                const x = lastX + Math.cos(angle) * i;
                const y = lastY + Math.sin(angle) * i;
                maskCtx.beginPath();
                maskCtx.arc(x, y, brushRadius, 0, Math.PI * 2);
                maskCtx.fill();
            }
            
            // Always draw at the current position
            maskCtx.beginPath();
            maskCtx.arc(currentX, currentY, brushRadius, 0, Math.PI * 2);
            maskCtx.fill();
        }
        
        lastX = currentX;
        lastY = currentY;
    }
    
    function handleTouchMove(e) {
        e.preventDefault();
        
        if (!isDrawing) return;
        
        const rect = maskCanvas.getBoundingClientRect();
        const touch = e.touches[0];
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;
        
        // Make sure we're using a bright red color that's easily detectable
        maskCtx.fillStyle = '#FF0000';  // Pure bright red
        
        // Draw with perfect round brush effect (same as mouse drawing)
        const brushRadius = parseInt(brushSize.value) / 2;
        
        // Calculate points along the path for smoother brush
        const dist = Math.sqrt(Math.pow(currentX - lastX, 2) + Math.pow(currentY - lastY, 2));
        const angle = Math.atan2(currentY - lastY, currentX - lastX);
        
        // For very small movements, just draw a circle
        if (dist < brushRadius/2) {
            maskCtx.beginPath();
            maskCtx.arc(currentX, currentY, brushRadius, 0, Math.PI * 2);
            maskCtx.fill();
        } else {
            // For longer movements, draw circles along the path
            for (let i = 0; i < dist; i += brushRadius/2) {
                const x = lastX + Math.cos(angle) * i;
                const y = lastY + Math.sin(angle) * i;
                maskCtx.beginPath();
                maskCtx.arc(x, y, brushRadius, 0, Math.PI * 2);
                maskCtx.fill();
            }
            
            // Always draw at the current position
            maskCtx.beginPath();
            maskCtx.arc(currentX, currentY, brushRadius, 0, Math.PI * 2);
            maskCtx.fill();
        }
        
        lastX = currentX;
        lastY = currentY;
    }
    
    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
            saveMaskState();
        }
    }
    
    // Update brush size
    function updateBrushSize() {
        maskCtx.lineWidth = parseInt(brushSize.value);
        brushSizeValue.textContent = brushSize.value + 'px';
        
        // Make sure we maintain the pure red color
        maskCtx.strokeStyle = '#FF0000';
        maskCtx.fillStyle = '#FF0000';
        
        // Update brush preview if we have one
        const brushPreview = document.querySelector('.brush-indicator');
        if (brushPreview) {
            const size = parseInt(brushSize.value);
            brushPreview.style.width = (size/2) + 'px';
            brushPreview.style.height = (size/2) + 'px';
            brushPreview.style.backgroundColor = '#FF0000'; // Ensure the preview is bright red
        }
    }
    
    // Save mask state for undo/redo
    function saveMaskState() {
        // Remove any states after the current index if we're in the middle of the history
        if (maskHistoryIndex < maskHistory.length - 1) {
            maskHistory = maskHistory.slice(0, maskHistoryIndex + 1);
        }
        
        // Add current state to history
        maskHistory.push(maskCanvas.toDataURL());
        maskHistoryIndex = maskHistory.length - 1;
        
        // Enable/disable undo/redo buttons
        updateUndoRedoButtons();
    }
    
    // Update undo/redo buttons based on history state
    function updateUndoRedoButtons() {
        undoBtn.disabled = maskHistoryIndex <= 0;
        redoBtn.disabled = maskHistoryIndex >= maskHistory.length - 1 || maskHistory.length === 0;
    }
    
    // Undo last mask edit
    function undoMaskEdit() {
        if (maskHistoryIndex > 0) {
            maskHistoryIndex--;
            restoreMaskState();
        }
    }
    
    // Redo last undone mask edit
    function redoMaskEdit() {
        if (maskHistoryIndex < maskHistory.length - 1) {
            maskHistoryIndex++;
            restoreMaskState();
        }
    }
    
    // Restore mask state from history
    function restoreMaskState() {
        if (maskHistory.length === 0 || maskHistoryIndex < 0) return;
        
        const img = new Image();
        img.onload = function() {
            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            maskCtx.drawImage(img, 0, 0);
            updateUndoRedoButtons();
        };
        img.src = maskHistory[maskHistoryIndex];
    }
    
    // Download the mask
    function downloadMask() {
        // Create a new canvas to extract just the mask (white areas)
        const extractedMaskCanvas = document.createElement('canvas');
        extractedMaskCanvas.width = maskCanvas.width;
        extractedMaskCanvas.height = maskCanvas.height;
        const extractedMaskCtx = extractedMaskCanvas.getContext('2d');
        
        // Fill with black (transparent areas in the final mask)
        extractedMaskCtx.fillStyle = 'black';
        extractedMaskCtx.fillRect(0, 0, extractedMaskCanvas.width, extractedMaskCanvas.height);
        
        // Get the data from the editor canvas
        const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const data = imageData.data;
        
        // Create a new ImageData for the extracted mask
        const extractedData = extractedMaskCtx.createImageData(maskCanvas.width, maskCanvas.height);
        const extractedDataArray = extractedData.data;
        
        // Detect red brush strokes (our mask color is red)
        for (let i = 0; i < data.length; i += 4) {
            // If the pixel is predominantly red (R > G+B significantly)
            // Using a more relaxed threshold to better detect our red marks
            if (data[i] > 200 && data[i] > (data[i+1] * 2) && data[i] > (data[i+2] * 2)) {
                extractedDataArray[i] = 255;     // R
                extractedDataArray[i+1] = 255;   // G
                extractedDataArray[i+2] = 255;   // B
                extractedDataArray[i+3] = 255;   // A
            } else {
                extractedDataArray[i] = 0;       // R
                extractedDataArray[i+1] = 0;     // G
                extractedDataArray[i+2] = 0;     // B
                extractedDataArray[i+3] = 255;   // A
            }
        }
        
        // Apply the extracted data to the canvas
        extractedMaskCtx.putImageData(extractedData, 0, 0);
        
        // Create a download link
        const link = document.createElement('a');
        link.download = 'mask.png';
        link.href = extractedMaskCanvas.toDataURL('image/png');
        link.click();
    }
    
    // Apply the created mask to the main app
    function applyMask() {
        // Create a new canvas to extract just the mask (white areas)
        const extractedMaskCanvas = document.createElement('canvas');
        extractedMaskCanvas.width = maskCanvas.width;
        extractedMaskCanvas.height = maskCanvas.height;
        const extractedMaskCtx = extractedMaskCanvas.getContext('2d');
        
        // Fill with black (transparent areas in the final mask)
        extractedMaskCtx.fillStyle = 'black';
        extractedMaskCtx.fillRect(0, 0, extractedMaskCanvas.width, extractedMaskCanvas.height);
        
        // Get the data from the editor canvas
        const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const data = imageData.data;
        
        // Create a new ImageData for the extracted mask
        const extractedData = extractedMaskCtx.createImageData(maskCanvas.width, maskCanvas.height);
        const extractedDataArray = extractedData.data;
        
        // Detect red brush strokes (our mask color is red)
        for (let i = 0; i < data.length; i += 4) {
            // If the pixel is predominantly red (R > G+B significantly)
            // Using a more relaxed threshold to better detect our red marks
            if (data[i] > 200 && data[i] > (data[i+1] * 2) && data[i] > (data[i+2] * 2)) {
                extractedDataArray[i] = 255;     // R
                extractedDataArray[i+1] = 255;   // G
                extractedDataArray[i+2] = 255;   // B
                extractedDataArray[i+3] = 255;   // A
            } else {
                extractedDataArray[i] = 0;       // R
                extractedDataArray[i+1] = 0;     // G
                extractedDataArray[i+2] = 0;     // B
                extractedDataArray[i+3] = 255;   // A
            }
        }
        
        // Apply the extracted data to the canvas
        extractedMaskCtx.putImageData(extractedData, 0, 0);
        
        // Preview the mask before applying
        const tempPreviewCanvas = document.createElement('canvas');
        tempPreviewCanvas.width = maskCanvas.width;
        tempPreviewCanvas.height = maskCanvas.height;
        const tempCtx = tempPreviewCanvas.getContext('2d');
        
        // Draw original image
        tempCtx.drawImage(originalImage, 0, 0, maskCanvas.width, maskCanvas.height);
        
        // Overlay the mask with semi-transparency
        tempCtx.globalAlpha = 0.6;
        tempCtx.fillStyle = 'red';
        
        // Get mask data
        const maskImageData = extractedMaskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const maskData = maskImageData.data;
        
        // Draw red overlay only where mask is white
        for (let i = 0; i < maskData.length; i += 4) {
            if (maskData[i] > 200) { // If white in mask
                // Calculate position
                const pixelIndex = i / 4;
                const x = pixelIndex % maskCanvas.width;
                const y = Math.floor(pixelIndex / maskCanvas.width);
                
                tempCtx.fillRect(x, y, 1, 1);
            }
        }
        
        // Show preview briefly
        const currentCanvas = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.drawImage(tempPreviewCanvas, 0, 0);
        
        // Store the generated mask after a brief preview
        setTimeout(() => {
            // Restore the original view
            maskCtx.putImageData(currentCanvas, 0, 0);
            
            // Update the mask image and input
            maskImage = new Image();
            maskImage.onload = function() {
                // Update the mask URL input field
                maskInput.value = maskImage.src;
                
                // Show preview of the mask
                const previewImg = document.createElement('img');
                previewImg.src = maskImage.src;
                previewImg.className = 'mask-preview';
                
                const previewContainer = document.querySelector('.input-field:nth-child(3)');
                const existingPreview = previewContainer.querySelector('.mask-preview');
                
                if (existingPreview) {
                    previewContainer.replaceChild(previewImg, existingPreview);
                } else {
                    previewContainer.appendChild(previewImg);
                }
                
                console.log("Mask created and applied:", maskImage.src);
                
                // Close the mask editor
                closeMaskEditor();
            };
            maskImage.src = extractedMaskCanvas.toDataURL('image/png');
        }, 1500);
    }
    
    // Generate design
    function generateDesign() {
        // Get selected style or prompt
        const selectedStyle = styleSelect.value;
        const customPrompt = promptInput.value.trim();
        
        // Validate inputs
        if (!selectedStyle && !customPrompt) {
            showError('Please either select a style or enter a design prompt');
            return;
        }
        
        if (!originalImage) {
            showError('Please upload an image first');
            return;
        }
        
        // Check if we have a mask
        if (!maskImage) {
            showError('Please upload or create a mask to indicate areas to modify');
            return;
        }
        
        // Show loading state
        loadingContainer.style.display = 'flex';
        resultContainer.classList.add('hidden');
        errorMessage.textContent = '';
        
        // Update status badge
        const statusBadge = document.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.textContent = 'Processing';
            statusBadge.classList.add('status-processing');
        }
        
        // Update loading message
        document.getElementById('loadingMessage').textContent = 'Generating your new design...';
        
        // Prepare the image and mask data
        const imageData = imageInput.value;
        const maskData = maskInput.value;
        
        // Send data to server
        fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: imageData,
                mask: maskData,
                prompt: customPrompt,
                style: selectedStyle
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Display result
            loadingContainer.style.display = 'none';
            resultContainer.classList.remove('hidden');
            
            // Reset status badge
            const statusBadge = document.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.textContent = 'Idle';
                statusBadge.classList.remove('status-processing');
            }
            
            if (data.error) {
                showError(data.error);
            } else {
                // Display the result image
                resultImage.src = data.result_url;
                
                // Reset style selection and prompt
                if (styleSelect.value) {
                    styleSelect.value = "";
                    promptInput.disabled = false;
                    promptInput.placeholder = 'e.g., Add white sofa and dark brown curtains on window';
                }
                promptInput.value = "";
            }
        })
        .catch(error => {
            loadingContainer.style.display = 'none';
            showError('Error generating design: ' + error.message);
        });
    }
    
    // Reset the design form
    function resetDesign() {
        // Clear inputs
        promptInput.value = '';
        imageInput.value = '';
        maskInput.value = '';
        styleSelect.value = '';
        
        // Reset state
        originalImage = null;
        maskImage = null;
        
        // Clear previews
        const previews = document.querySelectorAll('.image-preview, .mask-preview');
        previews.forEach(preview => preview.remove());
        
        // Reset result
        resultContainer.classList.add('hidden');
        errorMessage.textContent = '';
        
        // Enable prompt input
        promptInput.disabled = false;
        promptInput.placeholder = 'e.g., Add white sofa and dark brown curtains on window';
    }
    
    // Display error messages
    function showError(message) {
        errorMessage.textContent = message;
    }
    
    // Save/download the generated image
    function saveCurrentImage() {
        // Get the result image
        const imgUrl = resultImage.src;
        
        if (!imgUrl) {
            showError('No image to save.');
            return;
        }
        
        // Create a temporary link
        const link = document.createElement('a');
        link.href = imgUrl;
        
        // Generate a filename
        const date = new Date();
        const formattedDate = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        const formattedTime = `${date.getHours().toString().padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}`;
        
        link.download = `interior-design-${formattedDate}-${formattedTime}.jpg`;
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Initialize app
    init();
});
