document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // User is signed in, redirect to dashboard
            window.location.href = 'dashboard.html';
        }
    });

    // Login form submission
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        const loginAlert = document.getElementById('loginAlert');
        
        // Hide any previous error messages
        loginAlert.classList.add('d-none');
        
        // Set persistence based on Remember Me checkbox
        const persistenceType = rememberMe ? 
            firebase.auth.Auth.Persistence.LOCAL : 
            firebase.auth.Auth.Persistence.SESSION;
            
        firebase.auth().setPersistence(persistenceType)
            .then(() => {
                // Sign in with email and password
                return firebase.auth().signInWithEmailAndPassword(email, password);
            })
            .then((userCredential) => {
                // Signed in successfully
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                // Handle errors
                console.error("Login error:", error.code, error.message);
                loginAlert.textContent = getErrorMessage(error.code);
                loginAlert.classList.remove('d-none');
            });
    });
});

// Function to get user-friendly error messages
function getErrorMessage(errorCode) {
    switch(errorCode) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Email ou senha incorretos. Tente novamente.';
        case 'auth/invalid-email':
            return 'Email inválido. Verifique e tente novamente.';
        case 'auth/user-disabled':
            return 'Esta conta foi desativada. Entre em contato com o administrador.';
        case 'auth/too-many-requests':
            return 'Muitas tentativas malsucedidas. Tente novamente mais tarde.';
        default:
            return 'Erro ao fazer login. Tente novamente.';
    }
}