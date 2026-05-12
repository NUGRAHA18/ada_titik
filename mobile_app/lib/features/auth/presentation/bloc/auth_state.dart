import 'package:mobile_app/features/auth/domain/entities/user_entity.dart';
import 'package:equatable/equatable.dart';

enum AuthStatus { initial, loading, success, failure, waitingVerification, needsProfileCompletion}

class AuthState extends Equatable {
  final AuthStatus status;
  final String? errorMessage;
  
  // Data Form (In-Memory)
  final String email;
  final String password;
  final String name;
  final UserRole role;
  final String? uid;

  final UserEntity? user;

  const AuthState({
    this.status = AuthStatus.initial,
    this.email = '',
    this.password = '',
    this.name = '',
    this.role = UserRole.donatur, // Default role
    this.uid,
    this.errorMessage,
    this.user,
  });

  AuthState copyWith({
    AuthStatus? status,
    String? email,
    String? password,
    String? name,
    UserRole? role,
    String? uid,
    String? errorMessage,
    UserEntity? user,
  }) {
    return AuthState(
      status: status ?? this.status,
      email: email ?? this.email,
      password: password ?? this.password,
      name: name ?? this.name,
      role: role ?? this.role,
      uid: uid ?? this.uid,
      errorMessage: errorMessage ?? this.errorMessage,
      user: user ?? this.user,
    );
  }

  @override
  List<Object?> get props => [status, email, password, name, role, uid, errorMessage, user];
}