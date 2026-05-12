import 'package:mobile_app/features/auth/domain/entities/user_entity.dart';
import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

// Tahap 1: User mengisi Email & Password
class AuthRegisterStepOneSubmitted extends AuthEvent {
  final String email;
  final String password;
  final String name;

  AuthRegisterStepOneSubmitted({required this.email, required this.password, required this.name});

  @override
  List<Object?> get props => [email, password, name];
}

// Tahap 2: User mengisi Nama & Role, lalu SEKALIGUS menekan Daftar
class AuthRegisterFinalSubmitted extends AuthEvent {
  final UserRole role;

  AuthRegisterFinalSubmitted({required this.role});

  @override
  List<Object?> get props => [role];
}