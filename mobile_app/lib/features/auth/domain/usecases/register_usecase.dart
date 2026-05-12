import 'package:dartz/dartz.dart';
import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecases/usecase.dart';

class RegisterUseCase implements UseCase<UserEntity, RegisterParams>{
  final AuthRepository repository;

  RegisterUseCase(this.repository);

  @override
  Future<Either<Failure, UserEntity>> call(RegisterParams params) async {
    // --- VALIDASI LOGIKA BISNIS ---
    if (params.name.trim().isEmpty) {
      return const Left(ValidationFailure("Nama tidak boleh kosong"));
    }

    final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
    if (!emailRegex.hasMatch(params.email)) {
      return const Left(ValidationFailure("Format email tidak valid"));
    }
    
    if (params.password.length < 8) {
      return const Left(ValidationFailure("Password minimal 8 karakter"));
    }


    return await repository.registerWithEmail(
      email: params.email,
      password: params.password,
      name: params.name,
      role: params.role,
    );
  }
}

class RegisterParams{
  final String email;
  final String password;
  final String name;
  final UserRole role;

  RegisterParams({required this.email, required this.password, required this.name, required this.role });
}