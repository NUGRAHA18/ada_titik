import 'package:dartz/dartz.dart';
import 'package:mobile_app/core/error/failures.dart';

import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_ds.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;

  AuthRepositoryImpl({
    required this.remoteDataSource,
  });

  @override
  Future<Either<Failure, UserEntity>> registerWithEmail({
    required String name,
    required String email,
    required String password,
    required UserRole role,
  }) async {
    try {
      final userModel = await remoteDataSource.signUpWithEmail(
        name: name,
        email: email,
        password: password,
        role: role,
      );

      return Right(userModel); // Kembalikan sebagai Entity
    } catch (e) {
      String errorMessage = e.toString().replaceAll('Exception: ', '');
      return Left(ServerFailure(message: errorMessage));
    }
  }
}