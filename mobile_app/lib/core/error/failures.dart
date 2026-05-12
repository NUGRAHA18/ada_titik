import 'package:equatable/equatable.dart';

abstract class Failure extends Equatable {
  final String message;
  const Failure(this.message);

  @override
  List<Object> get props => [message];
}

// Kegagalan dari Server (Django)
class ServerFailure extends Failure {
  const ServerFailure({String message = "Server Error"}) : super(message);
}

// Kegagalan dari Local Storage
class CacheFailure extends Failure {
  const CacheFailure({String message = "Cache Error"}) : super(message);
}

class ValidationFailure extends Failure {
  const ValidationFailure(String message) : super(message); 
}
class PermissionFailure extends Failure {
  const PermissionFailure(String message) : super(message);
}
class LocationFailure extends Failure {
  const LocationFailure(String message) : super(message);
}