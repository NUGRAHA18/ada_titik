import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';

import '../entities/user_entity.dart';

abstract class AuthRepository {
  Future<Either<Failure, UserEntity>> registerWithEmail({
    required String name,
    required String email,
    required String password,
    required UserRole role, 
  });
}