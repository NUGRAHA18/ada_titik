import 'package:get_it/get_it.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// data
import 'features/auth/data/datasources/auth_remote_ds.dart';
import 'features/auth/data/repositories/auth_repository_impl.dart';

//domain
import 'features/auth/domain/repositories/auth_repository.dart';
import 'features/auth/domain/usecases/register_usecase.dart';

// presentantion
import 'features/auth/presentation/bloc/auth_bloc.dart';

import 'core/network/dio_client.dart';

final sl = GetIt.instance;

Future<void> init() async {
  
  sl.registerLazySingleton(() => const FlutterSecureStorage());
  // 1. Daftarkan DioClient (Class pengatur config)
  sl.registerLazySingleton(() => DioClient(sl()));
  
  // 2. Daftarkan instance Dio-nya (Ini yang akan diambil oleh DataSource)
  sl.registerLazySingleton<Dio>(() => sl<DioClient>().instance);
  //! Data sources
  sl.registerLazySingleton<AuthRemoteDataSource>(
    () => AuthRemoteDataSourceImpl(client: sl()), 
  );

  //! Repository
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(
      remoteDataSource: sl(),
    ),
  );

  //! Use cases
  sl.registerLazySingleton(() => RegisterUseCase(sl()));
  
  //! BLoC
  sl.registerFactory(() => AuthBloc(
        registerUseCase: sl(),
      ));
}