var sessionStore = {};

exports = module.exports;

exports.get = function(sessionId) {
	return sessionStore[sessionId];
};


exports.create = function(sessionId, username){
		var token = {
			username: username,
			score: 0,
			isAdmin: false
		}

		sessionStore[sessionId] = token;
		return token;
	};

exports.del = function(sessionId){
		delete sessionStore[sessionId];
	};
	
exports.scored = function(sessionId){
		sessionStore[sessionId].score += 1; 
	};

exports.isAdmin = function(sessionId){
		return sessionStore[sessionId].isAdmin;
	};

exports.setNewAdmin = function(sessionId){
		sessionStore[sessionId].isAdmin = true;
		return sessionStore[sessionId];
	}; 
