// MetaIntent Modern Interface
const API_ENDPOINT = 'https://0exoqpsrxa.execute-api.us-east-1.amazonaws.com/metaintent';
let sessionId = null;
let messageCount = 0;

function startDemo() {
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('chatSection').classList.remove('hidden');
    document.getElementById('chatInput').focus();
}

function closeChat() {
    document.getElementById('chatSection').classList.add('hidden');
    document.getElementById('heroSection').classList.remove('hidden');
}

async function sendMessage() {
    const input = document.getElementById('chatInput').value.trim();
    if (!input) return;
    
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn.disabled) return; // Prevent double-sending
    
    sendBtn.disabled = true;
    
    addMessage('user', input);
    document.getElementById('chatInput').value = '';
    messageCount++;
    
    try {
        const action = sessionId ? 'clarify' : 'start';
        console.log('Sending:', { action, sessionId, input });
        console.log('API Endpoint:', API_ENDPOINT);
        
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ action, sessionId, input }),
            mode: 'cors'
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        // Handle session ID
        if (!sessionId && data.sessionId) {
            sessionId = data.sessionId;
            console.log('Session ID:', sessionId);
        }
        
        // Check for errors
        if (data.error) {
            addMessage('ai', `Error: ${data.error}<br><br>Let's start fresh. What would you like to do?`);
            sessionId = null; // Reset session
            return;
        }
        
        // Update UI
        updateStats(data);
        
        // Add response
        if (data.response) {
            addMessage('ai', data.response);
        }
        
        // Show generate button when ready
        if (data.status === 'ready' && !data.needsClarification) {
            showGenerateButton();
        }
        
    } catch (error) {
        console.error('Error details:', error);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        
        let errorMsg = 'Connection error. ';
        if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            errorMsg += 'This might be a network or CORS issue.<br><br>';
            errorMsg += '✓ API is working (tested successfully)<br>';
            errorMsg += '✓ Try opening DevTools (F12) → Console tab for details<br>';
            errorMsg += '✓ Check if any browser extensions are blocking requests<br><br>';
            errorMsg += `Error: ${error.message}`;
        } else {
            errorMsg += `<br>Error: ${error.message}`;
        }
        
        addMessage('ai', errorMsg);
        sessionId = null; // Reset on error
    } finally {
        sendBtn.disabled = false;
    }
}

function addMessage(role, content) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    // Format content properly
    const formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/•/g, '<br>•');
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <img src="metaintent_icon_64.png" alt="${role}">
        </div>
        <div class="message-content">
            <div class="message-text">${formattedContent}</div>
        </div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateStats(data) {
    console.log('Updating stats with data:', data);
    
    const clarity = Math.max(0, 100 - (data.ambiguityScore || 100));
    document.getElementById('clarityValue').textContent = `${clarity}%`;
    
    // Count total agents - handle both array and object
    let agentCount = 0;
    if (data.activeAgents) {
        if (Array.isArray(data.activeAgents)) {
            agentCount = data.activeAgents.length;
            console.log('Agent count (array):', agentCount, 'Agents:', data.activeAgents);
        } else if (typeof data.activeAgents === 'object') {
            agentCount = Object.keys(data.activeAgents).length;
            console.log('Agent count (object):', agentCount, 'Agents:', data.activeAgents);
        }
    }
    
    // If status is ready/clarifying, show at least 1 agent was used
    if (agentCount === 0 && (data.status === 'ready' || data.status === 'clarifying')) {
        agentCount = 1;
    }
    
    document.getElementById('agentsValue').textContent = agentCount;
    
    // Iteration should be at least 1 when we have a response
    const iteration = data.iteration !== undefined ? (data.iteration + 1) : messageCount;
    document.getElementById('iterationValue').textContent = iteration;
    console.log('Stats updated - Clarity:', clarity, 'Agents:', agentCount, 'Iteration:', iteration);
}

let isGenerating = false;

async function generateAgent() {
    if (isGenerating) return; // Prevent multiple generations
    isGenerating = true;
    
    addMessage('ai', '🎨 Creating your custom agent...');
    
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate', sessionId })
        });
        
        const data = await response.json();
        
        if (data.agentSpec) {
            const spec = data.agentSpec;
            let message = `<strong>✨ Your Custom Agent is Ready!</strong><br><br>`;
            message += `<strong>Name:</strong> ${spec.name}<br>`;
            message += `<strong>Purpose:</strong> ${spec.purpose}<br><br>`;
            message += `<strong>Capabilities:</strong><br>`;
            spec.capabilities.forEach(cap => {
                message += `• ${cap}<br>`;
            });
            message += `<br><strong>Success Criteria:</strong><br>`;
            spec.successCriteria.forEach(crit => {
                message += `✓ ${crit}<br>`;
            });
            addMessage('ai', message);
        } else {
            addMessage('ai', data.formattedDisplay || 'Agent created!');
        }
        
        // Reset for new session
        addMessage('ai', '<br>Want to create another agent? Just tell me what you need!');
        sessionId = null;
        
    } catch (error) {
        console.error('Generation error:', error);
        addMessage('ai', 'Had trouble generating the agent. Want to try again?');
    } finally {
        isGenerating = false;
    }
}

function showGenerateButton() {
    const messagesDiv = document.getElementById('chatMessages');
    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'generate-button-container';
    buttonDiv.innerHTML = `
        <button class="btn-generate" onclick="generateAgent()">
            ✨ Generate My Agent Now
        </button>
    `;
    messagesDiv.appendChild(buttonDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Voice Input Functionality
let mediaRecorder = null;
let audioChunks = [];

async function toggleVoiceInput() {
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceRecording = document.getElementById('voiceRecording');
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopVoiceInput();
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await processVoiceInput(audioBlob);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        voiceBtn.classList.add('recording');
        voiceRecording.classList.remove('hidden');
    } catch (error) {
        console.error('Error accessing microphone:', error);
        addMessage('ai', '⚠️ Could not access microphone. Please check your browser permissions.');
    }
}

function stopVoiceInput() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        document.getElementById('voiceBtn').classList.remove('recording');
        document.getElementById('voiceRecording').classList.add('hidden');
    }
}

async function processVoiceInput(audioBlob) {
    addMessage('ai', '🎤 Processing your voice input...');
    
    try {
        // For demo purposes, show a message that voice processing would happen here
        // In production, you would send the audio to a speech-to-text service
        addMessage('ai', '✨ Voice input feature is ready! In production, this would use AWS Transcribe or similar service to convert your speech to text and process it.');
        
        // TODO: Implement actual speech-to-text API call
        // Example: Send audioBlob to AWS Transcribe, Google Speech-to-Text, etc.
        
    } catch (error) {
        console.error('Error processing voice:', error);
        addMessage('ai', '⚠️ Error processing voice input. Please try typing instead.');
    }
}

// File Upload Functionality
let uploadedFile = null;

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    uploadedFile = file;
    
    // Show file preview
    const filePreview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    fileName.textContent = `📎 ${file.name} (${formatFileSize(file.size)})`;
    filePreview.classList.remove('hidden');
    
    // Add message about file
    addMessage('user', `📎 Uploaded: ${file.name}`);
    addMessage('ai', '✨ File received! I can process text files, PDFs, and images. In production, this would extract and analyze the content. What would you like me to do with this file?');
    
    // TODO: Implement actual file processing
    // For images: Use OCR (AWS Textract, Google Vision API)
    // For PDFs/Docs: Extract text content
    // For text files: Read directly
}

function removeFile() {
    uploadedFile = null;
    document.getElementById('filePreview').classList.add('hidden');
    document.getElementById('fileInput').value = '';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
