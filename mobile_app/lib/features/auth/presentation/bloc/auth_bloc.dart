import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/usecases/register_usecase.dart';

import 'auth_event.dart';
import 'auth_state.dart';


class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final RegisterUseCase registerUseCase;
  
  AuthBloc({
    required this.registerUseCase,
  }) : super(AuthState()) {

    on<AuthRegisterStepOneSubmitted>((event, emit) {
      // Simpan data step 1 dan arahkan UI ke step 2
      emit(state.copyWith(
        email: event.email,
        password: event.password,
        name: event.name
      ));
    });

    on<AuthRegisterFinalSubmitted>((event, emit) async {
      emit(state.copyWith(status: AuthStatus.loading, errorMessage: null));

      // Ambil email & password dari state sebelumnya, nama & role dari event sekarang
      final result = await registerUseCase(RegisterParams(
        email: state.email,
        password: state.password,
        name: state.name,
        role: event.role,
      ));

      result.fold(
        (failure) => emit(state.copyWith(
          status: AuthStatus.failure,
          errorMessage: failure.message,
        )),
        (userEntity) => emit(state.copyWith(
          status: AuthStatus.success,
          user: userEntity,
        )),
      );
    });
  }
}