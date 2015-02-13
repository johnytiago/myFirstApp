var Hapi = require('hapi'),
	server = Hapi.createServer(8080),
	bcrypt = require('bcrypt');

var	questionsDb = require('./quizBd.js'),
	sessionStore = require('./sessionStore.js'),
	MongoClient = require('mongodb').MongoClient,
	assert = require('assert'),
	mongoose = require('mongoose');

//DB configuration
mongoose.connect('mongodb://localhost/myproject');

var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var Account = mongoose.model('Account', new Schema({
	id: ObjectId,
	username: String,
	password: String,
	score: Number,
	isAdmin: Boolean
}));

//Server Views and Cookies
server.views({
    engines: {
        html: require('handlebars')
    },
    path: 'views',
    helpersPath: 'helpers'
});

server.state('session',
	{ 
		ttl: 30 * 60 * 1000,
        encoding: 'base64json',
        isHttpOnly: true 
    }
);

// ROUTES
server.route({
	method: 'GET',
	path: '/' ,
	handler: function(request, reply){
		reply.file('./views/welcome-page.html');
	}
});

server.route({
	method: 'POST',
	path: '/signUp',
	handler: function(request, reply){
		console.log(request.payload);
		var account = new Account({
			username: request.payload.username,
			password: bcrypt.hashSync(request.payload.password, bcrypt.genSaltSync(10)),
			isAdmin: false
		});
		account.save();		
		console.log(sessionStore.create( Math.random().toString(36).substring(7), request.payload.username));
		reply.redirect('/login');
	}	
});

server.route({
	method: 'GET',
	path: '/login',
	handler: function(request, reply){
		var sessionId = request.state.session;
		if(!validateSession(sessionId)){
			reply.file('./views/login-page.html');
			//DELETE COOKIE SERVER-SIDE
		}
		else{
			reply.redirect('question/1');
		}
	}
});

server.route({
	method: 'POST',
	path: '/login',
	handler: function(request, reply){
		/* Verificar se o nome existe na db */
		Account.findOne({ username: request.payload.username }, function (err, doc){
			if(doc){
				bcrypt.compare( request.payload.password, doc.password, function(err, res){
					if(res){
						if(doc.isAdmin){
							reply.redirect('/adminDashboard');
						}
						else{
							var sessionId = Math.random().toString(36).substring(7); 
							sessionStore.create(sessionId, request.payload.username);
							reply().redirect('/question/1').state('session', sessionId);
						}
					}
					else{
						// wrong password
						reply.redirect('/login');	
					}
				})
			}
			else{
				// wrong name
				reply.redirect('/login');
			}
		})
	}
});

server.route({
	method: 'GET',
	path: '/logout',
	handler: function(request, reply){
		var sessionId = request.state.session;
		if(!sessionId){
			reply.redirect('/login');
		}
		else{
			sessionStore.del(sessionId);
			reply.file('./views/logout-page.html');
		}
	}
})
	
server.route({
	method: 'GET',
	path: '/question/{number}',
	handler: function(request, reply){
		var sessionId = request.state.session; 
		var questNumber = request.params.number -1;

		if(!validateSession(sessionId)){
			console.log('Nao tem sessionId');
			reply.redirect('/');
		}

		else{
			console.log('Tem sessionId:', sessionId);
			if(request.params.number <1){
				questNumber = 0;
				request.params.number = 0;
			}

			if(request.params.number > questionsDb.length){
				reply().redirect('/score');
				return;		
			}
				
			reply
				.view('question-page', {
					questionInfo: questionsDb[questNumber].question,
					answerInfo: questionsDb[questNumber].choices,
					id: request.params.number,
					nav:{ 
					  	prev: request.params.number-1,
					  	next: Number(request.params.number)+1
					}
				});
		}
	}
});

server.route({
	method: 'POST',
	path: '/question/{number}',
	handler: function(request,reply){
		var sessionId = request.state.session;		
	
		if(request.payload.answer === questionsDb[request.params.number-1].answer){
			sessionStore.scored(sessionId);
			reply().redirect('/question/' + request.params.number);
			console.log('Correct');
		}
		else{
			console.log('Wrong');
			// because its a form
			reply().redirect('/question/' + request.params.number); 
		}
	}
});

server.route({
	method: 'GET',
	path: '/score',
	handler: function(request, reply){
		var sessionId = request.state.session;
		if(!sessionId){
			reply.redirect('/login');
		}
		else{
			if(validateSession(sessionId)){
				Account.findOne({ username: sessionStore.get(sessionId).username}, function(err, doc){
					if(doc){
						reply.view('score-page.html', {
							score: doc.score,
							nav:{
								prev: questionsDb.length
							}
						});
					}
					else{
						reply.redirect('/login');
					}
				});
			}
			else{
				// DELETE COOKIE SERVER-SIDE

			}		
		}
	}
});

server.route({
	method: 'GET',
	path: '/adminDashboard',
	handler: function(request, reply){
		var scoreInfo = [{ username: 'teste1', score: 2}, { username: 'teste2', score: 0}, { username: 'teste3', score: 1}];
		reply.view('admin-page.html', { scoreInfo: scoreInfo});
	}
});

//Function to validate the user session
function validateSession(sessionId){
	console.log(sessionStore.get(sessionId));
	return sessionStore.get(sessionId);
}

server.start(function(){

	console.log('Server running at: ', server.info.uri);

	Account.findOne({ username: 'admin'}, function(err, doc){
		if(err){
			console.log('Admin not created due to an error');
		}
		else{
			if(!doc){
				console.log('admin created ');
				// Register the main admin
				var admin = new Account({
					isAdmin: true,
					username: 'admin',
					password: bcrypt.hashSync('admin', bcrypt.genSaltSync(10)),
				});
				admin.save();			
			}
			else{
				console.log('Admin already created');
			}
		}
	});
});